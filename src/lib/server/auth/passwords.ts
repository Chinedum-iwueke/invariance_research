import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

export function hashPassword(password: string): string {
  const normalized = password.trim();
  if (!normalized) {
    throw new Error("password_required");
  }

  const salt = randomBytes(16);
  const derived = scryptSync(normalized, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });

  return [
    "scrypt",
    String(SCRYPT_N),
    String(SCRYPT_R),
    String(SCRYPT_P),
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
}

export function verifyPassword(password: string, storedHash?: string | null): boolean {
  if (!storedHash) return false;

  const [algorithm, nRaw, rRaw, pRaw, saltRaw, keyRaw] = storedHash.split("$");
  if (algorithm !== "scrypt" || !nRaw || !rRaw || !pRaw || !saltRaw || !keyRaw) {
    return false;
  }

  const n = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) {
    return false;
  }

  try {
    const salt = Buffer.from(saltRaw, "base64");
    const expected = Buffer.from(keyRaw, "base64");
    const derived = scryptSync(password.trim(), salt, expected.length, { N: n, r, p });
    return timingSafeEqual(expected, derived);
  } catch {
    return false;
  }
}
