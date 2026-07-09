import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

type LlmCredentialPayload = { api_key: string };

function key(): Buffer {
  const raw =
    process.env.LLM_CREDENTIAL_ENCRYPTION_KEY?.trim() ||
    (process.env.NODE_ENV === "production" ? "" : process.env.NEXTAUTH_SECRET?.trim()) ||
    (process.env.NODE_ENV === "production" ? "" : "dev-llm-credential-key");
  if (!raw) throw new Error("llm_credential_encryption_key_missing");
  if (process.env.NODE_ENV === "production" && raw.length < 32) throw new Error("llm_credential_encryption_key_too_short");
  return createHash("sha256").update(raw).digest();
}

export function encryptLlmProviderCredential(payload: LlmCredentialPayload) {
  if (!payload.api_key.trim()) throw new Error("llm_api_key_required");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptLlmProviderCredential(value: string): LlmCredentialPayload {
  const [version, ivRaw, tagRaw, bodyRaw] = value.split(".");
  if (version !== "v1" || !ivRaw || !tagRaw || !bodyRaw) throw new Error("llm_credential_envelope_invalid");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  const decoded = Buffer.concat([decipher.update(Buffer.from(bodyRaw, "base64url")), decipher.final()]).toString("utf8");
  const parsed = JSON.parse(decoded) as LlmCredentialPayload;
  if (!parsed.api_key) throw new Error("llm_credential_payload_invalid");
  return parsed;
}

export function llmApiKeyHint(apiKey: string) {
  const clean = apiKey.trim();
  return clean.length <= 12 ? "••••" : `${clean.slice(0, 7)}••••${clean.slice(-4)}`;
}
