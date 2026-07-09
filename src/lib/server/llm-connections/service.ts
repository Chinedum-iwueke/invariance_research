import { randomUUID } from "node:crypto";
import { encryptLlmProviderCredential, llmApiKeyHint } from "@/lib/server/llm-connections/credential-vault";
import { llmProviderConnectionRepository } from "@/lib/server/llm-connections/repository";
import type { LlmProviderConnection } from "@/lib/server/llm-connections/models";

const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";

function normalizeModel(value: unknown) {
  const model = typeof value === "string" ? value.trim() : "";
  return model || process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
}

export async function testOpenAiApiKey(input: { apiKey: string; model?: string; signal?: AbortSignal }) {
  const apiKey = input.apiKey.trim();
  if (apiKey.length < 20) throw new Error("openai_api_key_invalid");
  const model = normalizeModel(input.model);
  const startedAt = Date.now();
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 5,
      messages: [{ role: "user", content: "Reply with exactly OK." }],
    }),
    signal: input.signal,
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`openai_connection_failed_${response.status}${body ? `:${body.slice(0, 160)}` : ""}`);
  }
  const payload = await response.json().catch(() => ({})) as { usage?: { prompt_tokens?: number; completion_tokens?: number } };
  return {
    ok: true,
    provider: "openai" as const,
    model,
    duration_ms: Date.now() - startedAt,
    prompt_tokens: payload.usage?.prompt_tokens,
    completion_tokens: payload.usage?.completion_tokens,
  };
}

export async function saveOpenAiConnection(input: {
  accountId: string;
  userId: string;
  apiKey: string;
  model?: string;
  label?: string;
  validate?: boolean;
}) {
  const apiKey = input.apiKey.trim();
  const model = normalizeModel(input.model);
  if (apiKey.length < 20) throw new Error("openai_api_key_invalid");
  const now = new Date().toISOString();
  let check: Awaited<ReturnType<typeof testOpenAiApiKey>> | undefined;
  if (input.validate !== false) check = await testOpenAiApiKey({ apiKey, model });
  const connection: LlmProviderConnection = {
    connection_id: randomUUID(),
    account_id: input.accountId,
    created_by_user_id: input.userId,
    provider: "openai",
    label: input.label?.trim().slice(0, 80) || "OpenAI API key",
    status: "active",
    credential_ciphertext: encryptLlmProviderCredential({ api_key: apiKey }),
    credential_key_version: "llm-v1",
    api_key_hint: llmApiKeyHint(apiKey),
    default_model: model,
    usage_mode: "byok",
    last_checked_at: check ? now : undefined,
    last_error: undefined,
    created_at: now,
    updated_at: now,
  };
  await llmProviderConnectionRepository.save(connection);
  await llmProviderConnectionRepository.audit({
    event_id: randomUUID(),
    connection_id: connection.connection_id,
    account_id: input.accountId,
    actor_user_id: input.userId,
    event_type: "created",
    metadata: { provider: "openai", model, validated: Boolean(check), api_key_hint: connection.api_key_hint },
    created_at: now,
  });
  return { ...connection, credential_ciphertext: undefined, credential_key_version: undefined };
}

export async function listLlmProviderConnections(accountId: string) {
  return {
    connections: await llmProviderConnectionRepository.list(accountId),
    audit_events: await llmProviderConnectionRepository.recentAudit(accountId),
  };
}

export async function revokeLlmProviderConnection(input: { accountId: string; userId: string; connectionId: string }) {
  const connection = await llmProviderConnectionRepository.find(input.connectionId, input.accountId);
  if (!connection) throw new Error("llm_connection_not_found");
  await llmProviderConnectionRepository.revoke(input.connectionId, input.accountId);
  await llmProviderConnectionRepository.audit({
    event_id: randomUUID(),
    connection_id: input.connectionId,
    account_id: input.accountId,
    actor_user_id: input.userId,
    event_type: "revoked",
    metadata: { provider: connection.provider, api_key_hint: connection.api_key_hint },
    created_at: new Date().toISOString(),
  });
  return { connection_id: input.connectionId, status: "revoked" as const };
}
