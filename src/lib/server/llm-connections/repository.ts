import { getDb } from "@/lib/server/persistence/database";
import { getDatabaseProvider } from "@/lib/server/persistence/provider";
import { getPostgresPool } from "@/lib/server/persistence/postgres";
import type { LlmProviderAuditEvent, LlmProviderConnection, LlmProviderId } from "@/lib/server/llm-connections/models";

const iso = (value: unknown) => value instanceof Date ? value.toISOString() : String(value);
const json = <T>(value: unknown, fallback: T): T => value == null ? fallback : (typeof value === "string" ? JSON.parse(value) : value) as T;

async function rows(pg: string, sqlite: string, params: unknown[]) {
  if (getDatabaseProvider() === "postgres") return (await getPostgresPool().query(pg, params)).rows as Record<string, unknown>[];
  return getDb().prepare(sqlite).all(...params) as Record<string, unknown>[];
}

async function run(pg: string, sqlite: string, params: unknown[]) {
  if (getDatabaseProvider() === "postgres") await getPostgresPool().query(pg, params);
  else getDb().prepare(sqlite).run(...params);
}

function mapConnection(row: Record<string, unknown>, includeSecret = false): LlmProviderConnection {
  return {
    connection_id: String(row.connection_id),
    account_id: String(row.account_id),
    created_by_user_id: String(row.created_by_user_id),
    provider: row.provider as LlmProviderId,
    label: String(row.label),
    status: row.status as LlmProviderConnection["status"],
    credential_ciphertext: includeSecret ? String(row.credential_ciphertext) : undefined,
    credential_key_version: includeSecret ? String(row.credential_key_version) : undefined,
    api_key_hint: String(row.api_key_hint),
    default_model: String(row.default_model),
    usage_mode: row.usage_mode as LlmProviderConnection["usage_mode"],
    last_checked_at: row.last_checked_at ? iso(row.last_checked_at) : undefined,
    last_error: row.last_error ? String(row.last_error) : undefined,
    last_used_at: row.last_used_at ? iso(row.last_used_at) : undefined,
    revoked_at: row.revoked_at ? iso(row.revoked_at) : undefined,
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
  };
}

export const llmProviderConnectionRepository = {
  async list(accountId: string) {
    return (await rows(
      "SELECT * FROM llm_provider_connections WHERE account_id=$1 ORDER BY created_at DESC",
      "SELECT * FROM llm_provider_connections WHERE account_id=? ORDER BY created_at DESC",
      [accountId],
    )).map((row) => mapConnection(row));
  },

  async find(connectionId: string, accountId: string, includeSecret = false) {
    const result = await rows(
      "SELECT * FROM llm_provider_connections WHERE connection_id=$1 AND account_id=$2",
      "SELECT * FROM llm_provider_connections WHERE connection_id=? AND account_id=?",
      [connectionId, accountId],
    );
    return result[0] ? mapConnection(result[0], includeSecret) : undefined;
  },

  async findActiveForAccount(accountId: string, provider: LlmProviderId, includeSecret = false) {
    const result = await rows(
      "SELECT * FROM llm_provider_connections WHERE account_id=$1 AND provider=$2 AND status='active' ORDER BY updated_at DESC LIMIT 1",
      "SELECT * FROM llm_provider_connections WHERE account_id=? AND provider=? AND status='active' ORDER BY updated_at DESC LIMIT 1",
      [accountId, provider],
    );
    return result[0] ? mapConnection(result[0], includeSecret) : undefined;
  },

  async save(value: LlmProviderConnection) {
    const now = value.updated_at;
    await run(
      `UPDATE llm_provider_connections
       SET status='revoked', revoked_at=$3, updated_at=$3
       WHERE account_id=$1 AND provider=$2 AND status='active'`,
      "UPDATE llm_provider_connections SET status='revoked', revoked_at=?, updated_at=? WHERE account_id=? AND provider=? AND status='active'",
      getDatabaseProvider() === "postgres" ? [value.account_id, value.provider, now] : [now, now, value.account_id, value.provider],
    );
    const params = [
      value.connection_id,
      value.account_id,
      value.created_by_user_id,
      value.provider,
      value.label,
      value.status,
      value.credential_ciphertext,
      value.credential_key_version,
      value.api_key_hint,
      value.default_model,
      value.usage_mode,
      value.last_checked_at ?? null,
      value.last_error ?? null,
      value.last_used_at ?? null,
      value.revoked_at ?? null,
      value.created_at,
      value.updated_at,
    ];
    await run(
      `INSERT INTO llm_provider_connections
       (connection_id, account_id, created_by_user_id, provider, label, status, credential_ciphertext, credential_key_version, api_key_hint, default_model, usage_mode, last_checked_at, last_error, last_used_at, revoked_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      `INSERT INTO llm_provider_connections
       (connection_id, account_id, created_by_user_id, provider, label, status, credential_ciphertext, credential_key_version, api_key_hint, default_model, usage_mode, last_checked_at, last_error, last_used_at, revoked_at, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      params,
    );
    return value;
  },

  async updateHealth(connectionId: string, accountId: string, patch: { ok: boolean; error?: string; used?: boolean }) {
    const now = new Date().toISOString();
    await run(
      "UPDATE llm_provider_connections SET last_checked_at=$3, last_error=$4, last_used_at=CASE WHEN $5 THEN $3 ELSE last_used_at END, updated_at=$3 WHERE connection_id=$1 AND account_id=$2",
      "UPDATE llm_provider_connections SET last_checked_at=?, last_error=?, last_used_at=CASE WHEN ? THEN ? ELSE last_used_at END, updated_at=? WHERE connection_id=? AND account_id=?",
      getDatabaseProvider() === "postgres" ? [connectionId, accountId, now, patch.ok ? null : patch.error ?? "provider_check_failed", patch.used === true] : [now, patch.ok ? null : patch.error ?? "provider_check_failed", patch.used === true ? 1 : 0, now, now, connectionId, accountId],
    );
  },

  async revoke(connectionId: string, accountId: string) {
    const now = new Date().toISOString();
    await run(
      "UPDATE llm_provider_connections SET status='revoked', revoked_at=$3, updated_at=$3 WHERE connection_id=$1 AND account_id=$2",
      "UPDATE llm_provider_connections SET status='revoked', revoked_at=?, updated_at=? WHERE connection_id=? AND account_id=?",
      getDatabaseProvider() === "postgres" ? [connectionId, accountId, now] : [now, now, connectionId, accountId],
    );
  },

  async audit(value: LlmProviderAuditEvent) {
    const params = [value.event_id, value.connection_id, value.account_id, value.actor_user_id, value.event_type, JSON.stringify(value.metadata), value.created_at];
    await run(
      "INSERT INTO llm_provider_audit_events (event_id, connection_id, account_id, actor_user_id, event_type, metadata_json, created_at) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)",
      "INSERT INTO llm_provider_audit_events (event_id, connection_id, account_id, actor_user_id, event_type, metadata_json, created_at) VALUES (?,?,?,?,?,?,?)",
      params,
    );
  },

  async recentAudit(accountId: string, limit = 20) {
    const capped = Math.max(1, Math.min(limit, 100));
    return (await rows(
      "SELECT * FROM llm_provider_audit_events WHERE account_id=$1 ORDER BY created_at DESC LIMIT $2",
      "SELECT * FROM llm_provider_audit_events WHERE account_id=? ORDER BY created_at DESC LIMIT ?",
      [accountId, capped],
    )).map((row) => ({
      event_id: String(row.event_id),
      connection_id: String(row.connection_id),
      account_id: String(row.account_id),
      actor_user_id: String(row.actor_user_id),
      event_type: String(row.event_type),
      metadata: json(row.metadata_json, {}),
      created_at: iso(row.created_at),
    }));
  },
};
