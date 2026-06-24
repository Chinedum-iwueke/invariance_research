import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

type CredentialPayload = { api_key: string; api_secret: string };

function key(): Buffer {
  const raw = process.env.EXCHANGE_CREDENTIAL_ENCRYPTION_KEY?.trim();
  if (!raw) throw new Error("exchange_credential_encryption_key_missing");
  if (process.env.NODE_ENV === "production" && raw.length < 32) throw new Error("exchange_credential_encryption_key_too_short");
  return createHash("sha256").update(raw).digest();
}

export function encryptExchangeCredentials(payload: CredentialPayload) {
  if (!payload.api_key.trim() || !payload.api_secret.trim()) throw new Error("exchange_credentials_required");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptExchangeCredentials(value: string): CredentialPayload {
  const [version, ivRaw, tagRaw, bodyRaw] = value.split(".");
  if (version !== "v1" || !ivRaw || !tagRaw || !bodyRaw) throw new Error("exchange_credential_envelope_invalid");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  const decoded = Buffer.concat([decipher.update(Buffer.from(bodyRaw, "base64url")), decipher.final()]).toString("utf8");
  const parsed = JSON.parse(decoded) as CredentialPayload;
  if (!parsed.api_key || !parsed.api_secret) throw new Error("exchange_credential_payload_invalid");
  return parsed;
}

export function credentialHint(apiKey: string) {
  const clean = apiKey.trim();
  return clean.length <= 8 ? "••••" : `${clean.slice(0, 4)}••••${clean.slice(-4)}`;
}
