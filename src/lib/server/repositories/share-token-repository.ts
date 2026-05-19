import type { ShareAccessEvent, ShareTokenRecord } from "@/lib/server/share/models";
import { getDb } from "@/lib/server/persistence/database";

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
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
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
    created_at: String(row.created_at),
  };
}

export const shareTokenRepository = {
  save(record: ShareTokenRecord) {
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

  findByTokenHash(tokenHash: string) {
    const row = getDb().prepare("SELECT * FROM share_tokens WHERE token_hash = ?").get(tokenHash) as Record<string, unknown> | undefined;
    return row ? mapToken(row) : undefined;
  },

  revoke(shareId: string, revokedAt = new Date().toISOString()) {
    getDb().prepare("UPDATE share_tokens SET status = 'revoked', revoked_at = ?, updated_at = ? WHERE share_id = ?").run(revokedAt, revokedAt, shareId);
    return this.findById(shareId);
  },

  findById(shareId: string) {
    const row = getDb().prepare("SELECT * FROM share_tokens WHERE share_id = ?").get(shareId) as Record<string, unknown> | undefined;
    return row ? mapToken(row) : undefined;
  },

  listByAnalysis(analysisId: string) {
    const rows = getDb()
      .prepare("SELECT * FROM share_tokens WHERE analysis_id = ? ORDER BY created_at DESC")
      .all(analysisId) as Record<string, unknown>[];
    return rows.map(mapToken);
  },

  listExpired(nowIso: string) {
    const rows = getDb().prepare("SELECT * FROM share_tokens WHERE expires_at IS NOT NULL AND expires_at <= ?").all(nowIso) as Record<string, unknown>[];
    return rows.map(mapToken);
  },
};

export const shareAccessEventRepository = {
  save(event: ShareAccessEvent) {
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

  listByShare(shareId: string) {
    const rows = getDb()
      .prepare("SELECT * FROM share_access_events WHERE share_id = ? ORDER BY created_at DESC")
      .all(shareId) as Record<string, unknown>[];
    return rows.map(mapAccessEvent);
  },

  listByAnalysis(analysisId: string) {
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
