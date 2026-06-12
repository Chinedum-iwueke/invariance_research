import type { ExportRecord } from "@/lib/server/exports/models";
import { getDb } from "@/lib/server/persistence/database";
import { getDatabaseProvider } from "@/lib/server/persistence/provider";
import { getPostgresPool } from "@/lib/server/persistence/postgres";

function iso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function mapRow(row: Record<string, unknown>): ExportRecord {
  return {
    export_id: String(row.export_id),
    analysis_id: String(row.analysis_id),
    program_id: row.program_id ? String(row.program_id) : undefined,
    account_id: String(row.account_id),
    requested_by_user_id: String(row.requested_by_user_id),
    report_snapshot_id: row.report_snapshot_id ? String(row.report_snapshot_id) : undefined,
    format: row.format as ExportRecord["format"],
    status: row.status as ExportRecord["status"],
    storage_key: row.storage_key ? String(row.storage_key) : undefined,
    content_type: row.content_type ? String(row.content_type) : undefined,
    file_size_bytes: row.file_size_bytes === null ? undefined : Number(row.file_size_bytes),
    checksum_sha256: row.checksum_sha256 ? String(row.checksum_sha256) : undefined,
    error_code: row.error_code ? String(row.error_code) : undefined,
    error_message: row.error_message ? String(row.error_message) : undefined,
    requested_at: iso(row.requested_at),
    expires_at: row.expires_at ? iso(row.expires_at) : undefined,
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
  };
}

export const exportRepository = {
  save(record: ExportRecord): ExportRecord | Promise<ExportRecord> {
    if (getDatabaseProvider() === "postgres") {
      return getPostgresPool()
        .query(
          `INSERT INTO exports (export_id, analysis_id, program_id, account_id, requested_by_user_id, report_snapshot_id, format, status, storage_key, content_type, file_size_bytes, checksum_sha256, error_code, error_message, requested_at, expires_at, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
          [
            record.export_id,
            record.analysis_id,
            record.program_id ?? null,
            record.account_id,
            record.requested_by_user_id,
            record.report_snapshot_id ?? null,
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
          ],
        )
        .then(() => record);
    }
    getDb()
      .prepare(`INSERT INTO exports (export_id, analysis_id, program_id, account_id, requested_by_user_id, report_snapshot_id, format, status, storage_key, content_type, file_size_bytes, checksum_sha256, error_code, error_message, requested_at, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(
        record.export_id,
        record.analysis_id,
        record.program_id ?? null,
        record.account_id,
        record.requested_by_user_id,
        record.report_snapshot_id ?? null,
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
  findById(exportId: string): ExportRecord | undefined | Promise<ExportRecord | undefined> {
    if (getDatabaseProvider() === "postgres") {
      return getPostgresPool().query("SELECT * FROM exports WHERE export_id = $1", [exportId]).then((result) => result.rows[0] ? mapRow(result.rows[0]) : undefined);
    }
    const row = getDb().prepare("SELECT * FROM exports WHERE export_id = ?").get(exportId) as Record<string, unknown> | undefined;
    return row ? mapRow(row) : undefined;
  },
  listByAnalysis(analysisId: string): ExportRecord[] | Promise<ExportRecord[]> {
    if (getDatabaseProvider() === "postgres") {
      return getPostgresPool().query("SELECT * FROM exports WHERE analysis_id = $1 ORDER BY created_at DESC", [analysisId]).then((result) => result.rows.map(mapRow));
    }
    const rows = getDb().prepare("SELECT * FROM exports WHERE analysis_id = ? ORDER BY created_at DESC").all(analysisId) as Record<string, unknown>[];
    return rows.map(mapRow);
  },
  async update(exportId: string, updater: (current: ExportRecord) => ExportRecord): Promise<ExportRecord | undefined> {
    const current = await this.findById(exportId);
    if (!current) return undefined;
    const next = updater(current);
    if (getDatabaseProvider() === "postgres") {
      await getPostgresPool().query(
        `UPDATE exports SET status=$1, report_snapshot_id=$2, storage_key=$3, content_type=$4, file_size_bytes=$5, checksum_sha256=$6, error_code=$7, error_message=$8, expires_at=$9, updated_at=$10 WHERE export_id=$11`,
        [
          next.status,
          next.report_snapshot_id ?? null,
          next.storage_key ?? null,
          next.content_type ?? null,
          next.file_size_bytes ?? null,
          next.checksum_sha256 ?? null,
          next.error_code ?? null,
          next.error_message ?? null,
          next.expires_at ?? null,
          next.updated_at,
          exportId,
        ],
      );
      return next;
    }
    getDb()
      .prepare(`UPDATE exports SET status=?, report_snapshot_id=?, storage_key=?, content_type=?, file_size_bytes=?, checksum_sha256=?, error_code=?, error_message=?, expires_at=?, updated_at=? WHERE export_id=?`)
      .run(
        next.status,
        next.report_snapshot_id ?? null,
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
  listExpired(nowIso: string): ExportRecord[] | Promise<ExportRecord[]> {
    if (getDatabaseProvider() === "postgres") {
      return getPostgresPool().query("SELECT * FROM exports WHERE expires_at IS NOT NULL AND expires_at <= $1", [nowIso]).then((result) => result.rows.map(mapRow));
    }
    const rows = getDb().prepare("SELECT * FROM exports WHERE expires_at IS NOT NULL AND expires_at <= ?").all(nowIso) as Record<string, unknown>[];
    return rows.map(mapRow);
  },
  delete(exportId: string): void | Promise<void> {
    if (getDatabaseProvider() === "postgres") {
      return getPostgresPool().query("DELETE FROM exports WHERE export_id = $1", [exportId]).then(() => undefined);
    }
    getDb().prepare("DELETE FROM exports WHERE export_id = ?").run(exportId);
  },
};
