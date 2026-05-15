import { createHash, randomBytes, randomUUID } from "node:crypto";
import { getDatabaseProvider } from "@/lib/server/persistence/provider";
import { getPostgresPool } from "@/lib/server/persistence/postgres";
import { getSqliteRuntimeDb } from "@/lib/server/persistence/sqlite-runtime";

export type AuthTokenPurpose = "email_verification" | "password_reset";

export interface AuthTokenRecord {
  token_id: string;
  user_id: string;
  purpose: AuthTokenPurpose;
  token_hash: string;
  expires_at: string;
  consumed_at?: string;
  created_at: string;
}

export function generateAuthToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashAuthToken(token) };
}

export function hashAuthToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function mapRecord(row: Record<string, unknown>): AuthTokenRecord {
  const iso = (value: unknown) => value instanceof Date ? value.toISOString() : String(value);
  return {
    token_id: String(row.token_id),
    user_id: String(row.user_id),
    purpose: row.purpose as AuthTokenPurpose,
    token_hash: String(row.token_hash),
    expires_at: iso(row.expires_at),
    consumed_at: row.consumed_at ? iso(row.consumed_at) : undefined,
    created_at: iso(row.created_at),
  };
}

export const authTokenRepository = {
  async create(input: { userId: string; purpose: AuthTokenPurpose; tokenHash: string; expiresAt: string }) {
    const now = new Date().toISOString();
    const tokenId = randomUUID();
    if (getDatabaseProvider() === "postgres") {
      await getPostgresPool().query(
        "INSERT INTO auth_tokens (token_id, user_id, purpose, token_hash, expires_at, created_at) VALUES ($1,$2,$3,$4,$5,$6)",
        [tokenId, input.userId, input.purpose, input.tokenHash, input.expiresAt, now],
      );
    } else {
      getSqliteRuntimeDb()
        .prepare("INSERT INTO auth_tokens (token_id, user_id, purpose, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .run(tokenId, input.userId, input.purpose, input.tokenHash, input.expiresAt, now);
    }
    return tokenId;
  },

  async findActiveByHash(tokenHash: string, purpose: AuthTokenPurpose, now = new Date()) {
    const nowIso = now.toISOString();
    if (getDatabaseProvider() === "postgres") {
      const result = await getPostgresPool().query<Record<string, unknown>>(
        "SELECT * FROM auth_tokens WHERE token_hash = $1 AND purpose = $2 AND consumed_at IS NULL AND expires_at > $3",
        [tokenHash, purpose, nowIso],
      );
      return result.rows[0] ? mapRecord(result.rows[0]) : undefined;
    }
    const row = getSqliteRuntimeDb()
      .prepare("SELECT * FROM auth_tokens WHERE token_hash = ? AND purpose = ? AND consumed_at IS NULL AND expires_at > ?")
      .get(tokenHash, purpose, nowIso) as Record<string, unknown> | undefined;
    return row ? mapRecord(row) : undefined;
  },

  async consume(tokenId: string) {
    const now = new Date().toISOString();
    if (getDatabaseProvider() === "postgres") {
      await getPostgresPool().query("UPDATE auth_tokens SET consumed_at = $1 WHERE token_id = $2", [now, tokenId]);
      return;
    }
    getSqliteRuntimeDb().prepare("UPDATE auth_tokens SET consumed_at = ? WHERE token_id = ?").run(now, tokenId);
  },

  async consumeOutstanding(userId: string, purpose: AuthTokenPurpose) {
    const now = new Date().toISOString();
    if (getDatabaseProvider() === "postgres") {
      await getPostgresPool().query("UPDATE auth_tokens SET consumed_at = $1 WHERE user_id = $2 AND purpose = $3 AND consumed_at IS NULL", [now, userId, purpose]);
      return;
    }
    getSqliteRuntimeDb().prepare("UPDATE auth_tokens SET consumed_at = ? WHERE user_id = ? AND purpose = ? AND consumed_at IS NULL").run(now, userId, purpose);
  },
};
