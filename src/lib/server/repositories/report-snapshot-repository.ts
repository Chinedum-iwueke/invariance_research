import type { ReportSnapshotRecord } from "@/lib/server/exports/models";
import { getDb } from "@/lib/server/persistence/database";
import { getDatabaseProvider } from "@/lib/server/persistence/provider";
import { getPostgresPool } from "@/lib/server/persistence/postgres";

function iso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function jsonValue<T>(value: unknown): T {
  return (typeof value === "string" ? JSON.parse(value) : value) as T;
}

function mapRow(row: Record<string, unknown>): ReportSnapshotRecord {
  return {
    snapshot_id: String(row.snapshot_id),
    analysis_id: String(row.analysis_id),
    account_id: String(row.account_id),
    status: row.status as ReportSnapshotRecord["status"],
    source_analysis_updated_at: iso(row.source_analysis_updated_at),
    source_result_checksum: String(row.source_result_checksum),
    payload: jsonValue(row.payload_json),
    warning_count: Number(row.warning_count),
    created_at: iso(row.created_at),
    superseded_at: row.superseded_at ? iso(row.superseded_at) : undefined,
  };
}

export const reportSnapshotRepository = {
  save(snapshot: ReportSnapshotRecord): ReportSnapshotRecord | Promise<ReportSnapshotRecord> {
    if (getDatabaseProvider() === "postgres") {
      return getPostgresPool()
        .query(
          `INSERT INTO report_snapshots (snapshot_id, analysis_id, account_id, status, source_analysis_updated_at, source_result_checksum, payload_json, warning_count, created_at, superseded_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
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
          ],
        )
        .then(() => snapshot);
    }
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

  asyncFindById(snapshotId: string): Promise<ReportSnapshotRecord | undefined> {
    return Promise.resolve(this.findById(snapshotId));
  },

  findById(snapshotId: string): ReportSnapshotRecord | undefined | Promise<ReportSnapshotRecord | undefined> {
    if (getDatabaseProvider() === "postgres") {
      return getPostgresPool()
        .query("SELECT * FROM report_snapshots WHERE snapshot_id = $1", [snapshotId])
        .then((result) => (result.rows[0] ? mapRow(result.rows[0]) : undefined));
    }
    const row = getDb().prepare("SELECT * FROM report_snapshots WHERE snapshot_id = ?").get(snapshotId) as Record<string, unknown> | undefined;
    return row ? mapRow(row) : undefined;
  },

  findByAnalysisAndChecksum(analysisId: string, checksum: string): ReportSnapshotRecord | undefined | Promise<ReportSnapshotRecord | undefined> {
    if (getDatabaseProvider() === "postgres") {
      return getPostgresPool()
        .query("SELECT * FROM report_snapshots WHERE analysis_id = $1 AND source_result_checksum = $2", [analysisId, checksum])
        .then((result) => (result.rows[0] ? mapRow(result.rows[0]) : undefined));
    }
    const row = getDb()
      .prepare("SELECT * FROM report_snapshots WHERE analysis_id = ? AND source_result_checksum = ?")
      .get(analysisId, checksum) as Record<string, unknown> | undefined;
    return row ? mapRow(row) : undefined;
  },

  findActiveByAnalysis(analysisId: string): ReportSnapshotRecord | undefined | Promise<ReportSnapshotRecord | undefined> {
    if (getDatabaseProvider() === "postgres") {
      return getPostgresPool()
        .query("SELECT * FROM report_snapshots WHERE analysis_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1", [analysisId])
        .then((result) => (result.rows[0] ? mapRow(result.rows[0]) : undefined));
    }
    const row = getDb()
      .prepare("SELECT * FROM report_snapshots WHERE analysis_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1")
      .get(analysisId) as Record<string, unknown> | undefined;
    return row ? mapRow(row) : undefined;
  },

  listByAnalysis(analysisId: string): ReportSnapshotRecord[] | Promise<ReportSnapshotRecord[]> {
    if (getDatabaseProvider() === "postgres") {
      return getPostgresPool()
        .query("SELECT * FROM report_snapshots WHERE analysis_id = $1 ORDER BY created_at DESC", [analysisId])
        .then((result) => result.rows.map(mapRow));
    }
    const rows = getDb()
      .prepare("SELECT * FROM report_snapshots WHERE analysis_id = ? ORDER BY created_at DESC")
      .all(analysisId) as Record<string, unknown>[];
    return rows.map(mapRow);
  },

  supersedeActiveForAnalysis(analysisId: string, exceptSnapshotId: string, supersededAt: string): void | Promise<void> {
    if (getDatabaseProvider() === "postgres") {
      return getPostgresPool()
        .query(
          "UPDATE report_snapshots SET status = 'superseded', superseded_at = $1 WHERE analysis_id = $2 AND status = 'active' AND snapshot_id <> $3",
          [supersededAt, analysisId, exceptSnapshotId],
        )
        .then(() => undefined);
    }
    getDb()
      .prepare("UPDATE report_snapshots SET status = 'superseded', superseded_at = ? WHERE analysis_id = ? AND status = 'active' AND snapshot_id <> ?")
      .run(supersededAt, analysisId, exceptSnapshotId);
  },

  async markActive(snapshotId: string): Promise<ReportSnapshotRecord | undefined> {
    if (getDatabaseProvider() === "postgres") {
      const snapshot = await this.findById(snapshotId);
      if (!snapshot) return undefined;
      await getPostgresPool().query("UPDATE report_snapshots SET status = 'active', superseded_at = NULL WHERE snapshot_id = $1", [snapshotId]);
      return this.findById(snapshotId);
    }
    const snapshot = this.findById(snapshotId);
    if (!snapshot) return undefined;
    getDb().prepare("UPDATE report_snapshots SET status = 'active', superseded_at = NULL WHERE snapshot_id = ?").run(snapshotId);
    return Promise.resolve(this.findById(snapshotId));
  },
};
