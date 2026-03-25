import type { AnalysisEntity } from "@/lib/server/analysis/models";
import { getDb } from "@/lib/server/persistence/database";

function mapRow(row: Record<string, unknown>): AnalysisEntity {
  return {
    analysis_id: String(row.analysis_id),
    owner_user_id: String(row.owner_user_id),
    account_id: String(row.account_id),
    status: row.status as AnalysisEntity["status"],
    strategy_name: row.strategy_name ? String(row.strategy_name) : undefined,
    artifact_id: String(row.artifact_id),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    result: row.result_json ? JSON.parse(String(row.result_json)) : undefined,
    eligibility_snapshot: row.eligibility_snapshot_json ? JSON.parse(String(row.eligibility_snapshot_json)) : undefined,
    engine_context: row.engine_context_json ? JSON.parse(String(row.engine_context_json)) : undefined,
    benchmark: row.benchmark_json ? JSON.parse(String(row.benchmark_json)) : undefined,
    failure_code: row.failure_code ? String(row.failure_code) : undefined,
    failure_message: row.failure_message ? String(row.failure_message) : undefined,
  };
}

export const analysisRepository = {
  save(analysis: AnalysisEntity): AnalysisEntity {
    getDb()
      .prepare(
        `INSERT INTO analyses (analysis_id, owner_user_id, account_id, status, strategy_name, artifact_id, created_at, updated_at, result_json, eligibility_snapshot_json, engine_context_json, benchmark_json, failure_code, failure_message)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        analysis.analysis_id,
        analysis.owner_user_id,
        analysis.account_id,
        analysis.status,
        analysis.strategy_name ?? null,
        analysis.artifact_id,
        analysis.created_at,
        analysis.updated_at,
        analysis.result ? JSON.stringify(analysis.result) : null,
        analysis.eligibility_snapshot ? JSON.stringify(analysis.eligibility_snapshot) : null,
        analysis.engine_context ? JSON.stringify(analysis.engine_context) : null,
        analysis.benchmark ? JSON.stringify(analysis.benchmark) : null,
        analysis.failure_code ?? null,
        analysis.failure_message ?? null,
      );
    return analysis;
  },
  update(analysisId: string, updater: (current: AnalysisEntity) => AnalysisEntity): AnalysisEntity | undefined {
    const current = this.findById(analysisId);
    if (!current) return undefined;
    const next = updater(current);
    getDb()
      .prepare(
        `UPDATE analyses SET status=?, strategy_name=?, updated_at=?, result_json=?, eligibility_snapshot_json=?, engine_context_json=?, benchmark_json=?, failure_code=?, failure_message=? WHERE analysis_id=?`,
      )
      .run(
        next.status,
        next.strategy_name ?? null,
        next.updated_at,
        next.result ? JSON.stringify(next.result) : null,
        next.eligibility_snapshot ? JSON.stringify(next.eligibility_snapshot) : null,
        next.engine_context ? JSON.stringify(next.engine_context) : null,
        next.benchmark ? JSON.stringify(next.benchmark) : null,
        next.failure_code ?? null,
        next.failure_message ?? null,
        analysisId,
      );
    return next;
  },
  findById(analysisId: string): AnalysisEntity | undefined {
    const row = getDb().prepare("SELECT * FROM analyses WHERE analysis_id = ?").get(analysisId) as Record<string, unknown> | undefined;
    return row ? mapRow(row) : undefined;
  },
  list(): AnalysisEntity[] {
    const rows = getDb().prepare("SELECT * FROM analyses ORDER BY created_at DESC").all() as Record<string, unknown>[];
    return rows.map(mapRow);
  },
  countCompletedForMonth(accountId: string, monthBucket: string): number {
    const row = getDb()
      .prepare(
        `SELECT COUNT(*) as total
         FROM analyses
         WHERE account_id = ?
           AND status = 'completed'
           AND substr(updated_at, 1, 7) = ?`,
      )
      .get(accountId, monthBucket) as { total: number };
    return Number(row?.total ?? 0);
  },
  completedCountsByMonth(accountId: string): Array<{ month_bucket: string; completed_count: number }> {
    const rows = getDb()
      .prepare(
        `SELECT substr(updated_at, 1, 7) AS month_bucket, COUNT(*) AS completed_count
         FROM analyses
         WHERE account_id = ?
           AND status = 'completed'
         GROUP BY substr(updated_at, 1, 7)
         ORDER BY month_bucket ASC`,
      )
      .all(accountId) as Array<{ month_bucket: string; completed_count: number }>;
    return rows.map((row) => ({ month_bucket: String(row.month_bucket), completed_count: Number(row.completed_count) }));
  },
};
