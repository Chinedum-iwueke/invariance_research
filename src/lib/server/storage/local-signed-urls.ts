import { createHmac, timingSafeEqual } from "node:crypto";

type SignedObjectPayload = {
  storageKey: string;
  expiresAt: number;
  fileName?: string;
  contentType?: string;
};

function getSigningSecret() {
  return process.env.OBJECT_STORAGE_SIGNING_SECRET ?? process.env.NEXTAUTH_SECRET ?? "dev-local-object-storage-secret";
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signToken(serializedPayload: string) {
  return createHmac("sha256", getSigningSecret()).update(serializedPayload).digest("base64url");
}

export function createLocalSignedObjectUrl(input: SignedObjectPayload) {
  const serializedPayload = JSON.stringify(input);
  const payload = toBase64Url(serializedPayload);
  const signature = signToken(serializedPayload);
  return `/api/object-storage/signed?payload=${encodeURIComponent(payload)}&sig=${encodeURIComponent(signature)}`;
}

export function verifyLocalSignedObjectUrl(input: { payload: string; signature: string }) {
  const serializedPayload = fromBase64Url(input.payload);
  const expected = signToken(serializedPayload);
  const provided = input.signature;

  const valid =
    expected.length === provided.length
    && timingSafeEqual(Buffer.from(expected), Buffer.from(provided));

  if (!valid) {
    throw new Error("invalid_object_signature");
  }

  const parsed = JSON.parse(serializedPayload) as SignedObjectPayload;
  if (parsed.expiresAt < Date.now()) {
    throw new Error("expired_object_signature");
  }

  return parsed;
}
