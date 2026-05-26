import type { ShareAccessEvent, ShareTokenRecord } from "@/lib/server/share/models";
import { getDb } from "@/lib/server/persistence/database";
import { getDatabaseProvider } from "@/lib/server/persistence/provider";
import { getPostgresPool } from "@/lib/server/persistence/postgres";

function iso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function mapToken(row: Record<string, unknown>): ShareTokenRecord {
  return {
    share_id: String(row.share_id),
    token_hash: String(row.token_hash),
    report_snapshot_id: String(row.report_snapshot_id),
    analysis_id: String(row.analysis_id),
    account_id: String(row.account_id),
    created_by_user_id: String(row.created_by_user_id),
    status: row.status as ShareTokenRecord["status"],
    expires_at: row.expires_at ? String(row.expires_at) : undefined,
    revoked_at: row.revoked_at ? String(row.revoked_at) : undefined,
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
  };
}

function mapAccessEvent(row: Record<string, unknown>): ShareAccessEvent {
  return {
    event_id: String(row.event_id),
    share_id: row.share_id ? String(row.share_id) : undefined,
    token_hash_prefix: String(row.token_hash_prefix),
    report_snapshot_id: row.report_snapshot_id ? String(row.report_snapshot_id) : undefined,
    outcome: row.outcome as ShareAccessEvent["outcome"],
    ip_hash: row.ip_hash ? String(row.ip_hash) : undefined,
    user_agent_hash: row.user_agent_hash ? String(row.user_agent_hash) : undefined,
    created_at: iso(row.created_at),
  };
}

export const shareTokenRepository = {
  save(record: ShareTokenRecord): ShareTokenRecord | Promise<ShareTokenRecord> {
    if (getDatabaseProvider() === "postgres") {
      return getPostgresPool()
        .query(
          `INSERT INTO share_tokens (share_id, token_hash, report_snapshot_id, analysis_id, account_id, created_by_user_id, status, expires_at, revoked_at, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            record.share_id,
            record.token_hash,
            record.report_snapshot_id,
            record.analysis_id,
            record.account_id,
            record.created_by_user_id,
            record.status,
            record.expires_at ?? null,
            record.revoked_at ?? null,
            record.created_at,
            record.updated_at,
          ],
        )
        .then(() => record);
    }
    getDb()
      .prepare(
        `INSERT INTO share_tokens (share_id, token_hash, report_snapshot_id, analysis_id, account_id, created_by_user_id, status, expires_at, revoked_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.share_id,
        record.token_hash,
        record.report_snapshot_id,
        record.analysis_id,
        record.account_id,
        record.created_by_user_id,
        record.status,
        record.expires_at ?? null,
        record.revoked_at ?? null,
        record.created_at,
        record.updated_at,
      );
    return record;
  },

  findByTokenHash(tokenHash: string): ShareTokenRecord | undefined | Promise<ShareTokenRecord | undefined> {
    if (getDatabaseProvider() === "postgres") {
      return getPostgresPool().query("SELECT * FROM share_tokens WHERE token_hash = $1", [tokenHash]).then((result) => result.rows[0] ? mapToken(result.rows[0]) : undefined);
    }
    const row = getDb().prepare("SELECT * FROM share_tokens WHERE token_hash = ?").get(tokenHash) as Record<string, unknown> | undefined;
    return row ? mapToken(row) : undefined;
  },

  async revoke(shareId: string, revokedAt = new Date().toISOString()): Promise<ShareTokenRecord | undefined> {
    if (getDatabaseProvider() === "postgres") {
      await getPostgresPool().query("UPDATE share_tokens SET status = 'revoked', revoked_at = $1, updated_at = $2 WHERE share_id = $3", [revokedAt, revokedAt, shareId]);
      return this.findById(shareId);
    }
    getDb().prepare("UPDATE share_tokens SET status = 'revoked', revoked_at = ?, updated_at = ? WHERE share_id = ?").run(revokedAt, revokedAt, shareId);
    return Promise.resolve(this.findById(shareId));
  },

  findById(shareId: string): ShareTokenRecord | undefined | Promise<ShareTokenRecord | undefined> {
    if (getDatabaseProvider() === "postgres") {
      return getPostgresPool().query("SELECT * FROM share_tokens WHERE share_id = $1", [shareId]).then((result) => result.rows[0] ? mapToken(result.rows[0]) : undefined);
    }
    const row = getDb().prepare("SELECT * FROM share_tokens WHERE share_id = ?").get(shareId) as Record<string, unknown> | undefined;
    return row ? mapToken(row) : undefined;
  },

  listByAnalysis(analysisId: string): ShareTokenRecord[] | Promise<ShareTokenRecord[]> {
    if (getDatabaseProvider() === "postgres") {
      return getPostgresPool().query("SELECT * FROM share_tokens WHERE analysis_id = $1 ORDER BY created_at DESC", [analysisId]).then((result) => result.rows.map(mapToken));
    }
    const rows = getDb()
      .prepare("SELECT * FROM share_tokens WHERE analysis_id = ? ORDER BY created_at DESC")
      .all(analysisId) as Record<string, unknown>[];
    return rows.map(mapToken);
  },

  listExpired(nowIso: string): ShareTokenRecord[] | Promise<ShareTokenRecord[]> {
    if (getDatabaseProvider() === "postgres") {
      return getPostgresPool().query("SELECT * FROM share_tokens WHERE expires_at IS NOT NULL AND expires_at <= $1", [nowIso]).then((result) => result.rows.map(mapToken));
    }
    const rows = getDb().prepare("SELECT * FROM share_tokens WHERE expires_at IS NOT NULL AND expires_at <= ?").all(nowIso) as Record<string, unknown>[];
    return rows.map(mapToken);
  },
};

export const shareAccessEventRepository = {
  save(event: ShareAccessEvent): ShareAccessEvent | Promise<ShareAccessEvent> {
    if (getDatabaseProvider() === "postgres") {
      return getPostgresPool()
        .query(
          `INSERT INTO share_access_events (event_id, share_id, token_hash_prefix, report_snapshot_id, outcome, ip_hash, user_agent_hash, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            event.event_id,
            event.share_id ?? null,
            event.token_hash_prefix,
            event.report_snapshot_id ?? null,
            event.outcome,
            event.ip_hash ?? null,
            event.user_agent_hash ?? null,
            event.created_at,
          ],
        )
        .then(() => event);
    }
    getDb()
      .prepare(
        `INSERT INTO share_access_events (event_id, share_id, token_hash_prefix, report_snapshot_id, outcome, ip_hash, user_agent_hash, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        event.event_id,
        event.share_id ?? null,
        event.token_hash_prefix,
        event.report_snapshot_id ?? null,
        event.outcome,
        event.ip_hash ?? null,
        event.user_agent_hash ?? null,
        event.created_at,
      );
    return event;
  },

  listByShare(shareId: string): ShareAccessEvent[] | Promise<ShareAccessEvent[]> {
    if (getDatabaseProvider() === "postgres") {
      return getPostgresPool().query("SELECT * FROM share_access_events WHERE share_id = $1 ORDER BY created_at DESC", [shareId]).then((result) => result.rows.map(mapAccessEvent));
    }
    const rows = getDb()
      .prepare("SELECT * FROM share_access_events WHERE share_id = ? ORDER BY created_at DESC")
      .all(shareId) as Record<string, unknown>[];
    return rows.map(mapAccessEvent);
  },

  listByAnalysis(analysisId: string): ShareAccessEvent[] | Promise<ShareAccessEvent[]> {
    if (getDatabaseProvider() === "postgres") {
      return getPostgresPool()
        .query(
          `SELECT share_access_events.*
           FROM share_access_events
           JOIN share_tokens ON share_tokens.share_id = share_access_events.share_id
           WHERE share_tokens.analysis_id = $1
           ORDER BY share_access_events.created_at DESC`,
          [analysisId],
        )
        .then((result) => result.rows.map(mapAccessEvent));
    }
    const rows = getDb()
      .prepare(
        `SELECT share_access_events.*
         FROM share_access_events
         JOIN share_tokens ON share_tokens.share_id = share_access_events.share_id
         WHERE share_tokens.analysis_id = ?
         ORDER BY share_access_events.created_at DESC`,
      )
      .all(analysisId) as Record<string, unknown>[];
    return rows.map(mapAccessEvent);
  },
};
