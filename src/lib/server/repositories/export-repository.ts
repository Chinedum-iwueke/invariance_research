import type { ExportRecord } from "@/lib/server/exports/models";
import { getDb } from "@/lib/server/persistence/database";

function mapRow(row: Record<string, unknown>): ExportRecord {
  return {
    export_id: String(row.export_id),
    analysis_id: String(row.analysis_id),
    account_id: String(row.account_id),
    requested_by_user_id: String(row.requested_by_user_id),
    format: row.format as ExportRecord["format"],
    status: row.status as ExportRecord["status"],
    storage_key: row.storage_key ? String(row.storage_key) : undefined,
    content_type: row.content_type ? String(row.content_type) : undefined,
    file_size_bytes: row.file_size_bytes === null ? undefined : Number(row.file_size_bytes),
    checksum_sha256: row.checksum_sha256 ? String(row.checksum_sha256) : undefined,
    error_code: row.error_code ? String(row.error_code) : undefined,
    error_message: row.error_message ? String(row.error_message) : undefined,
    requested_at: String(row.requested_at),
    expires_at: row.expires_at ? String(row.expires_at) : undefined,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export const exportRepository = {
  save(record: ExportRecord) {
    getDb()
      .prepare(`INSERT INTO exports (export_id, analysis_id, account_id, requested_by_user_id, format, status, storage_key, content_type, file_size_bytes, checksum_sha256, error_code, error_message, requested_at, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(
        record.export_id,
        record.analysis_id,
        record.account_id,
        record.requested_by_user_id,
        record.format,
        record.status,
        record.storage_key ?? null,
        record.content_type ?? null,
        record.file_size_bytes ?? null,
        record.checksum_sha256 ?? null,
        record.error_code ?? null,
        record.error_message ?? null,
        record.requested_at,
        record.expires_at ?? null,
        record.created_at,
        record.updated_at,
      );
    return record;
  },
  findById(exportId: string) {
    const row = getDb().prepare("SELECT * FROM exports WHERE export_id = ?").get(exportId) as Record<string, unknown> | undefined;
    return row ? mapRow(row) : undefined;
  },
  listByAnalysis(analysisId: string) {
    const rows = getDb().prepare("SELECT * FROM exports WHERE analysis_id = ? ORDER BY created_at DESC").all(analysisId) as Record<string, unknown>[];
    return rows.map(mapRow);
  },
  update(exportId: string, updater: (current: ExportRecord) => ExportRecord) {
    const current = this.findById(exportId);
    if (!current) return undefined;
    const next = updater(current);
    getDb()
      .prepare(`UPDATE exports SET status=?, storage_key=?, content_type=?, file_size_bytes=?, checksum_sha256=?, error_code=?, error_message=?, expires_at=?, updated_at=? WHERE export_id=?`)
      .run(
        next.status,
        next.storage_key ?? null,
        next.content_type ?? null,
        next.file_size_bytes ?? null,
        next.checksum_sha256 ?? null,
        next.error_code ?? null,
        next.error_message ?? null,
        next.expires_at ?? null,
        next.updated_at,
        exportId,
      );
    return next;
  },
  listExpired(nowIso: string) {
    const rows = getDb().prepare("SELECT * FROM exports WHERE expires_at IS NOT NULL AND expires_at <= ?").all(nowIso) as Record<string, unknown>[];
    return rows.map(mapRow);
  },
  delete(exportId: string) {
    getDb().prepare("DELETE FROM exports WHERE export_id = ?").run(exportId);
  },
};
