import type { AnalysisJob } from "@/lib/server/analysis/models";
import type { AsyncAnalysisJobRepository } from "@/lib/server/persistence/contracts";
import { getPostgresPool, withPostgresTransaction } from "@/lib/server/persistence/postgres";

const DEFAULT_MAX_ATTEMPTS = 3;

function mapRow(row: Record<string, unknown>): AnalysisJob {
  return {
    job_id: String(row.job_id),
    analysis_id: String(row.analysis_id),
    account_id: row.account_id ? String(row.account_id) : undefined,
    job_type: row.job_type as AnalysisJob["job_type"],
    status: row.status as AnalysisJob["status"],
    progress_pct: row.progress_pct === null ? undefined : Number(row.progress_pct),
    current_step: row.current_step ? String(row.current_step) : undefined,
    error_code: row.error_code ? String(row.error_code) : undefined,
    error_message: row.error_message ? String(row.error_message) : undefined,
    created_at: new Date(String(row.created_at)).toISOString(),
    updated_at: row.updated_at ? new Date(String(row.updated_at)).toISOString() : undefined,
    started_at: row.started_at ? new Date(String(row.started_at)).toISOString() : undefined,
    finished_at: row.finished_at ? new Date(String(row.finished_at)).toISOString() : undefined,
    retry_count: Number(row.retry_count ?? 0),
    attempts: Number(row.attempts ?? row.retry_count ?? 0),
    max_attempts: Number(row.max_attempts ?? DEFAULT_MAX_ATTEMPTS),
    available_at: row.available_at ? new Date(String(row.available_at)).toISOString() : undefined,
    last_attempt_at: row.last_attempt_at ? new Date(String(row.last_attempt_at)).toISOString() : undefined,
    leased_until: row.leased_until ? new Date(String(row.leased_until)).toISOString() : undefined,
    last_error: row.last_error ? String(row.last_error) : undefined,
  };
}

export const postgresAnalysisJobRepository: AsyncAnalysisJobRepository = {
  mode: "read-write",
  async save(job) {
    await getPostgresPool().query(
      `INSERT INTO analysis_jobs (job_id, analysis_id, account_id, job_type, status, progress_pct, current_step, error_code, error_message, created_at, updated_at, started_at, finished_at, retry_count, attempts, max_attempts, available_at, last_attempt_at, leased_until, last_error)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
      [
        job.job_id,
        job.analysis_id,
        job.account_id ?? null,
        job.job_type,
        job.status,
        job.progress_pct ?? null,
        job.current_step ?? null,
        job.error_code ?? null,
        job.error_message ?? null,
        job.created_at,
        job.updated_at ?? new Date().toISOString(),
        job.started_at ?? null,
        job.finished_at ?? null,
        job.retry_count,
        job.attempts ?? job.retry_count ?? 0,
        job.max_attempts ?? DEFAULT_MAX_ATTEMPTS,
        job.available_at ?? job.created_at,
        job.last_attempt_at ?? null,
        job.leased_until ?? null,
        job.last_error ?? null,
      ],
    );
    return job;
  },
  async findByAnalysisId(analysisId) {
    const result = await getPostgresPool().query("SELECT * FROM analysis_jobs WHERE analysis_id = $1", [analysisId]);
    return result.rows[0] ? mapRow(result.rows[0]) : undefined;
  },
  async findById(jobId) {
    const result = await getPostgresPool().query("SELECT * FROM analysis_jobs WHERE job_id = $1", [jobId]);
    return result.rows[0] ? mapRow(result.rows[0]) : undefined;
  },
  async updateByAnalysisId(analysisId, updater) {
    const current = await this.findByAnalysisId(analysisId);
    if (!current) return undefined;
    const next = updater(current);
    await getPostgresPool().query(
      `UPDATE analysis_jobs
       SET status=$1, progress_pct=$2, current_step=$3, error_code=$4, error_message=$5, updated_at=$6,
           started_at=$7, finished_at=$8, retry_count=$9, attempts=$10, max_attempts=$11,
           available_at=$12, last_attempt_at=$13, leased_until=$14, last_error=$15
       WHERE analysis_id=$16`,
      [
        next.status,
        next.progress_pct ?? null,
        next.current_step ?? null,
        next.error_code ?? null,
        next.error_message ?? null,
        next.updated_at ?? new Date().toISOString(),
        next.started_at ?? null,
        next.finished_at ?? null,
        next.retry_count,
        next.attempts ?? next.retry_count ?? 0,
        next.max_attempts ?? DEFAULT_MAX_ATTEMPTS,
        next.available_at ?? null,
        next.last_attempt_at ?? null,
        next.leased_until ?? null,
        next.last_error ?? null,
        analysisId,
      ],
    );
    return next;
  },
  async claimNextQueued(nowIso, options) {
    const leaseUntil = new Date(Date.parse(nowIso) + (options?.leaseMs ?? 5 * 60 * 1000)).toISOString();
    return withPostgresTransaction(async (client) => {
      const result = await client.query(
        `SELECT *
         FROM analysis_jobs
         WHERE (
           status = 'queued'
           OR (status IN ('processing', 'running') AND leased_until IS NOT NULL AND leased_until <= $1::timestamptz)
           OR (status = 'failed' AND retry_count < COALESCE(max_attempts, $2))
         )
         AND COALESCE(available_at, created_at) <= $1::timestamptz
         ORDER BY created_at ASC
         FOR UPDATE SKIP LOCKED
         LIMIT 1`,
        [nowIso, DEFAULT_MAX_ATTEMPTS],
      );
      const row = result.rows[0];
      if (!row) return undefined;
      const claimed = mapRow(row);
      const nextAttempts = (claimed.attempts ?? claimed.retry_count ?? 0) + 1;
      const updated = await client.query(
        `UPDATE analysis_jobs
         SET status='processing',
             started_at=COALESCE(started_at, $1::timestamptz),
             updated_at=$1::timestamptz,
             last_attempt_at=$1::timestamptz,
             leased_until=$2::timestamptz,
             attempts=$3,
             current_step='Starting analysis',
             progress_pct=5
         WHERE job_id=$4
         RETURNING *`,
        [nowIso, leaseUntil, nextAttempts, claimed.job_id],
      );
      return updated.rows[0] ? mapRow(updated.rows[0]) : undefined;
    });
  },
  async listFailed(limit = 50) {
    const result = await getPostgresPool().query(
      "SELECT * FROM analysis_jobs WHERE status = 'failed' ORDER BY COALESCE(finished_at, updated_at, created_at) DESC LIMIT $1",
      [limit],
    );
    return result.rows.map(mapRow);
  },
  async listDeadLetters(limit = 50) {
    const result = await getPostgresPool().query(
      "SELECT * FROM analysis_jobs WHERE status = 'dead_letter' ORDER BY COALESCE(finished_at, updated_at, created_at) DESC LIMIT $1",
      [limit],
    );
    return result.rows.map(mapRow);
  },
};
