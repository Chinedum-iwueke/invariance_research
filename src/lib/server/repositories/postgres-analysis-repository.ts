import type { AnalysisEntity } from "@/lib/server/analysis/models";
import type { AnalysisRepository } from "@/lib/server/persistence/contracts";
import { getPostgresPool } from "@/lib/server/persistence/postgres";

function parseJson(value: unknown) {
  return typeof value === "string" ? JSON.parse(value) : value;
}

function iso(value: unknown) {
  return value instanceof Date ? value.toISOString() : String(value);
}

function mapRow(row: Record<string, unknown>): AnalysisEntity {
  return {
    analysis_id: String(row.analysis_id),
    owner_user_id: String(row.owner_user_id),
    account_id: String(row.account_id),
    status: row.status as AnalysisEntity["status"],
    strategy_name: row.strategy_name ? String(row.strategy_name) : undefined,
    program_id: row.program_id ? String(row.program_id) : undefined,
    artifact_id: String(row.artifact_id),
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
    result: row.result_json ? (parseJson(row.result_json) as AnalysisEntity["result"]) : undefined,
    eligibility_snapshot: row.eligibility_snapshot_json ? (parseJson(row.eligibility_snapshot_json) as AnalysisEntity["eligibility_snapshot"]) : undefined,
    engine_context: row.engine_context_json ? (parseJson(row.engine_context_json) as AnalysisEntity["engine_context"]) : undefined,
    benchmark: row.benchmark_json ? (parseJson(row.benchmark_json) as AnalysisEntity["benchmark"]) : undefined,
    runtime_config: row.runtime_config_json ? (parseJson(row.runtime_config_json) as AnalysisEntity["runtime_config"]) : undefined,
    failure_code: row.failure_code ? String(row.failure_code) : undefined,
    failure_message: row.failure_message ? String(row.failure_message) : undefined,
  };
}

export const postgresAnalysisRepository = {
  mode: "read-write",
  async save(analysis: AnalysisEntity) {
    await getPostgresPool().query(
      `INSERT INTO analyses (analysis_id, owner_user_id, account_id, status, strategy_name, program_id, artifact_id, created_at, updated_at, result_json, eligibility_snapshot_json, engine_context_json, benchmark_json, runtime_config_json, failure_code, failure_message)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        analysis.analysis_id,
        analysis.owner_user_id,
        analysis.account_id,
        analysis.status,
        analysis.strategy_name ?? null,
        analysis.program_id ?? null,
        analysis.artifact_id,
        analysis.created_at,
        analysis.updated_at,
        analysis.result ? JSON.stringify(analysis.result) : null,
        analysis.eligibility_snapshot ? JSON.stringify(analysis.eligibility_snapshot) : null,
        analysis.engine_context ? JSON.stringify(analysis.engine_context) : null,
        analysis.benchmark ? JSON.stringify(analysis.benchmark) : null,
        analysis.runtime_config ? JSON.stringify(analysis.runtime_config) : null,
        analysis.failure_code ?? null,
        analysis.failure_message ?? null,
      ],
    );
    return analysis;
  },
  async update(analysisId: string, updater: (current: AnalysisEntity) => AnalysisEntity) {
    const current = await postgresAnalysisRepository.findById(analysisId);
    if (!current) return undefined;
    const next = updater(current);
    await getPostgresPool().query(
      `UPDATE analyses SET status=$1, strategy_name=$2, program_id=$3, updated_at=$4, result_json=$5, eligibility_snapshot_json=$6, engine_context_json=$7, benchmark_json=$8, runtime_config_json=$9, failure_code=$10, failure_message=$11 WHERE analysis_id=$12`,
      [
        next.status,
        next.strategy_name ?? null,
        next.program_id ?? null,
        next.updated_at,
        next.result ? JSON.stringify(next.result) : null,
        next.eligibility_snapshot ? JSON.stringify(next.eligibility_snapshot) : null,
        next.engine_context ? JSON.stringify(next.engine_context) : null,
        next.benchmark ? JSON.stringify(next.benchmark) : null,
        next.runtime_config ? JSON.stringify(next.runtime_config) : null,
        next.failure_code ?? null,
        next.failure_message ?? null,
        analysisId,
      ],
    );
    return next;
  },
  async findById(analysisId: string) {
    const result = await getPostgresPool().query("SELECT * FROM analyses WHERE analysis_id = $1", [analysisId]);
    return result.rows[0] ? mapRow(result.rows[0]) : undefined;
  },
  async list() {
    const result = await getPostgresPool().query("SELECT * FROM analyses ORDER BY created_at DESC");
    return result.rows.map(mapRow);
  },
  async countCompletedForMonth(accountId: string, monthBucket: string) {
    const result = await getPostgresPool().query(
      `SELECT COUNT(*) AS total
       FROM analyses
       WHERE account_id = $1
         AND status = 'completed'
         AND to_char(updated_at, 'YYYY-MM') = $2`,
      [accountId, monthBucket],
    );
    return Number(result.rows[0]?.total ?? 0);
  },
  async completedCountsByMonth(accountId: string) {
    const result = await getPostgresPool().query(
      `SELECT to_char(updated_at, 'YYYY-MM') AS month_bucket, COUNT(*) AS completed_count
       FROM analyses
       WHERE account_id = $1
         AND status = 'completed'
       GROUP BY to_char(updated_at, 'YYYY-MM')
       ORDER BY month_bucket ASC`,
      [accountId],
    );
    return result.rows.map((row) => ({ month_bucket: String(row.month_bucket), completed_count: Number(row.completed_count) }));
  },
} as unknown as AnalysisRepository;
