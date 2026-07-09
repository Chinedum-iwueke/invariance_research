import { OllamaClient } from "@/lib/server/llm/ollama-client";
import { decryptLlmProviderCredential } from "@/lib/server/llm-connections/credential-vault";
import { llmProviderConnectionRepository } from "@/lib/server/llm-connections/repository";

export type StructuredChatResult = {
  content: string;
  provider: string;
  model?: string;
  duration_ms?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
};

export type StructuredChatOptions = {
  prompt: string;
  jsonSchema?: unknown;
  timeoutMs?: number;
};

export type ResearchChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type ResearchChatOptions = {
  messages: ResearchChatMessage[];
  jsonSchema?: unknown;
  timeoutMs?: number;
  signal?: AbortSignal;
  accountId?: string;
};

const providerFailures = new Map<string, { count: number; openedAt?: number }>();

function assertCircuitClosed(provider: string) {
  const state = providerFailures.get(provider);
  if (state?.openedAt && Date.now() - state.openedAt < 30_000) throw new Error(`llm_provider_circuit_open_${provider}`);
  if (state?.openedAt) providerFailures.delete(provider);
}

function recordProviderResult(provider: string, success: boolean) {
  if (success) {
    providerFailures.delete(provider);
    return;
  }
  const next = (providerFailures.get(provider)?.count ?? 0) + 1;
  providerFailures.set(provider, { count: next, openedAt: next >= 3 ? Date.now() : undefined });
}

function parseTimeout(input: string | undefined, fallback: number) {
  const value = Number.parseInt(input ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function getResearchAssistantConfig() {
  const provider = (process.env.LLM_PROVIDER ?? "ollama").trim().toLowerCase();
  return {
    enabled:
      process.env.LLM_RESEARCH_ASSISTANT_ENABLED?.trim().toLowerCase() === "true" ||
      process.env.LLM_INSIGHTS_ENABLED?.trim().toLowerCase() === "true",
    provider,
    ollamaModel: process.env.OLLAMA_MODEL?.trim() || "llama3.1:8b",
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL?.trim() || "http://localhost:11434",
    openaiModel: process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini",
    timeoutMs: parseTimeout(process.env.LLM_RESEARCH_ASSISTANT_TIMEOUT_MS ?? process.env.LLM_INSIGHTS_TIMEOUT_MS, 20000),
  };
}

export type ResolvedResearchAssistantRuntime = {
  enabled: boolean;
  provider: "openai" | "ollama" | string;
  providerLabel: string;
  model?: string;
  source: "account_byok" | "hosted" | "disabled";
  apiKey?: string;
  connectionId?: string;
};

export async function resolveResearchAssistantRuntime(accountId?: string, includeSecret = false): Promise<ResolvedResearchAssistantRuntime> {
  const config = getResearchAssistantConfig();
  if (accountId) {
    const connection = await llmProviderConnectionRepository.findActiveForAccount(accountId, "openai", includeSecret).catch(() => undefined);
    if (connection) {
      return {
        enabled: true,
        provider: "openai",
        providerLabel: "openai_byok",
        model: connection.default_model || config.openaiModel,
        source: "account_byok",
        apiKey: includeSecret && connection.credential_ciphertext ? decryptLlmProviderCredential(connection.credential_ciphertext).api_key : undefined,
        connectionId: connection.connection_id,
      };
    }
  }
  if (!config.enabled) return { enabled: false, provider: config.provider, providerLabel: "deterministic", source: "disabled" };
  return {
    enabled: true,
    provider: config.provider,
    providerLabel: config.provider,
    model: config.provider === "openai" ? config.openaiModel : config.ollamaModel,
    source: "hosted",
  };
}

export async function isResearchAssistantEnabledForAccount(accountId?: string) {
  return (await resolveResearchAssistantRuntime(accountId)).enabled;
}

export async function structuredChat(options: StructuredChatOptions): Promise<StructuredChatResult> {
  const config = getResearchAssistantConfig();
  if (!config.enabled) throw new Error("llm_research_assistant_disabled");

  if (config.provider === "ollama") {
    const result = await new OllamaClient({
      baseUrl: config.ollamaBaseUrl,
      model: config.ollamaModel,
      timeoutMs: options.timeoutMs ?? config.timeoutMs,
      retries: 1,
    }).structuredChat(options.prompt, options.jsonSchema ?? "json");
    return {
      content: result.content,
      provider: "ollama",
      model: result.model,
      duration_ms: result.duration_ms,
      prompt_tokens: result.prompt_tokens,
      completion_tokens: result.completion_tokens,
    };
  }

  if (config.provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) throw new Error("openai_api_key_missing");
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error(`openai_timeout_${options.timeoutMs ?? config.timeoutMs}ms`)), options.timeoutMs ?? config.timeoutMs);
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: config.openaiModel,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: options.prompt }],
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`openai_http_${response.status}`);
      const payload = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) throw new Error("openai_empty_response");
      return {
        content,
        provider: "openai",
        model: config.openaiModel,
        duration_ms: Date.now() - startedAt,
        prompt_tokens: payload.usage?.prompt_tokens,
        completion_tokens: payload.usage?.completion_tokens,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(`unsupported_llm_provider_${config.provider}`);
}

export async function researchChat(options: ResearchChatOptions): Promise<StructuredChatResult> {
  const config = getResearchAssistantConfig();
  const runtime = await resolveResearchAssistantRuntime(options.accountId, true);
  if (!runtime.enabled) throw new Error("llm_research_assistant_disabled");
  const circuitKey = `${runtime.providerLabel}:${options.accountId ?? "hosted"}`;
  assertCircuitClosed(circuitKey);
  const timeoutMs = options.timeoutMs ?? config.timeoutMs;
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`llm_timeout_${timeoutMs}ms`)), timeoutMs);

  try {
    if (runtime.provider === "openai") {
      const apiKey = runtime.apiKey ?? process.env.OPENAI_API_KEY?.trim();
      if (!apiKey) throw new Error("openai_api_key_missing");
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: runtime.model ?? config.openaiModel,
          temperature: 0.15,
          response_format: { type: "json_object" },
          messages: options.messages,
        }),
        signal: options.signal ? AbortSignal.any([controller.signal, options.signal]) : controller.signal,
      });
      if (!response.ok) throw new Error(`openai_http_${response.status}`);
      const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) throw new Error("openai_empty_response");
      recordProviderResult(circuitKey, true);
      if (runtime.connectionId && options.accountId) {
        await llmProviderConnectionRepository.updateHealth(runtime.connectionId, options.accountId, { ok: true, used: true }).catch(() => undefined);
      }
      return { content, provider: runtime.providerLabel, model: runtime.model ?? config.openaiModel, duration_ms: Date.now() - startedAt, prompt_tokens: payload.usage?.prompt_tokens, completion_tokens: payload.usage?.completion_tokens };
    }

    if (runtime.provider === "ollama") {
      const response = await fetch(`${config.ollamaBaseUrl.replace(/\/$/, "")}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: runtime.model ?? config.ollamaModel, stream: false, format: options.jsonSchema ?? "json", messages: options.messages, options: { temperature: 0.15 } }),
        signal: options.signal ? AbortSignal.any([controller.signal, options.signal]) : controller.signal,
      });
      if (!response.ok) throw new Error(`ollama_http_${response.status}`);
      const payload = await response.json() as { message?: { content?: string }; model?: string; prompt_eval_count?: number; eval_count?: number; total_duration?: number };
      const content = payload.message?.content;
      if (!content) throw new Error("ollama_empty_response");
      recordProviderResult(circuitKey, true);
      return { content, provider: runtime.providerLabel, model: payload.model ?? runtime.model ?? config.ollamaModel, duration_ms: payload.total_duration ? Math.round(payload.total_duration / 1_000_000) : Date.now() - startedAt, prompt_tokens: payload.prompt_eval_count, completion_tokens: payload.eval_count };
    }

    throw new Error(`unsupported_llm_provider_${runtime.provider}`);
  } catch (error) {
    recordProviderResult(circuitKey, false);
    if (runtime.connectionId && options.accountId) {
      await llmProviderConnectionRepository.updateHealth(runtime.connectionId, options.accountId, { ok: false, error: error instanceof Error ? error.message : "provider_failed" }).catch(() => undefined);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function getResearchAssistantProviderHealth() {
  const config = getResearchAssistantConfig();
  const failure = providerFailures.get(config.provider);
  return {
    enabled: config.enabled,
    provider: config.provider,
    model: config.provider === "openai" ? config.openaiModel : config.ollamaModel,
    circuit: failure?.openedAt && Date.now() - failure.openedAt < 30_000 ? "open" : "closed",
    consecutive_failures: failure?.count ?? 0,
  };
}
