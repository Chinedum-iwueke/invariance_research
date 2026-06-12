import { OllamaClient } from "@/lib/server/llm/ollama-client";

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
