import type { ReportSnapshotRecord } from "@/lib/server/exports/models";
import { getDb } from "@/lib/server/persistence/database";

function mapRow(row: Record<string, unknown>): ReportSnapshotRecord {
  return {
    snapshot_id: String(row.snapshot_id),
    analysis_id: String(row.analysis_id),
    account_id: String(row.account_id),
    status: row.status as ReportSnapshotRecord["status"],
    source_analysis_updated_at: String(row.source_analysis_updated_at),
    source_result_checksum: String(row.source_result_checksum),
    payload: JSON.parse(String(row.payload_json)),
    warning_count: Number(row.warning_count),
    created_at: String(row.created_at),
    superseded_at: row.superseded_at ? String(row.superseded_at) : undefined,
  };
}

export const reportSnapshotRepository = {
  save(snapshot: ReportSnapshotRecord) {
    getDb()
      .prepare(
        `INSERT INTO report_snapshots (snapshot_id, analysis_id, account_id, status, source_analysis_updated_at, source_result_checksum, payload_json, warning_count, created_at, superseded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        snapshot.snapshot_id,
        snapshot.analysis_id,
        snapshot.account_id,
        snapshot.status,
        snapshot.source_analysis_updated_at,
        snapshot.source_result_checksum,
        JSON.stringify(snapshot.payload),
        snapshot.warning_count,
        snapshot.created_at,
        snapshot.superseded_at ?? null,
      );
    return snapshot;
  },

  findById(snapshotId: string) {
    const row = getDb().prepare("SELECT * FROM report_snapshots WHERE snapshot_id = ?").get(snapshotId) as Record<string, unknown> | undefined;
    return row ? mapRow(row) : undefined;
  },

  findByAnalysisAndChecksum(analysisId: string, checksum: string) {
    const row = getDb()
      .prepare("SELECT * FROM report_snapshots WHERE analysis_id = ? AND source_result_checksum = ?")
      .get(analysisId, checksum) as Record<string, unknown> | undefined;
    return row ? mapRow(row) : undefined;
  },

  findActiveByAnalysis(analysisId: string) {
    const row = getDb()
      .prepare("SELECT * FROM report_snapshots WHERE analysis_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1")
      .get(analysisId) as Record<string, unknown> | undefined;
    return row ? mapRow(row) : undefined;
  },

  listByAnalysis(analysisId: string) {
    const rows = getDb()
      .prepare("SELECT * FROM report_snapshots WHERE analysis_id = ? ORDER BY created_at DESC")
      .all(analysisId) as Record<string, unknown>[];
    return rows.map(mapRow);
  },

  supersedeActiveForAnalysis(analysisId: string, exceptSnapshotId: string, supersededAt: string) {
    getDb()
      .prepare("UPDATE report_snapshots SET status = 'superseded', superseded_at = ? WHERE analysis_id = ? AND status = 'active' AND snapshot_id <> ?")
      .run(supersededAt, analysisId, exceptSnapshotId);
  },

  markActive(snapshotId: string) {
    const snapshot = this.findById(snapshotId);
    if (!snapshot) return undefined;
    getDb().prepare("UPDATE report_snapshots SET status = 'active', superseded_at = NULL WHERE snapshot_id = ?").run(snapshotId);
    return this.findById(snapshotId);
  },
};
