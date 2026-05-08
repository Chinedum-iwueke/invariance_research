import type { AnalysisJob } from "@/lib/server/analysis/models";
import type { AnalysisJobRepository } from "@/lib/server/persistence/contracts";
import { getDb } from "@/lib/server/persistence/database";

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
    created_at: String(row.created_at),
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
    started_at: row.started_at ? String(row.started_at) : undefined,
    finished_at: row.finished_at ? String(row.finished_at) : undefined,
    retry_count: Number(row.retry_count),
    attempts: row.attempts === null || row.attempts === undefined ? Number(row.retry_count ?? 0) : Number(row.attempts),
    max_attempts: row.max_attempts === null || row.max_attempts === undefined ? DEFAULT_MAX_ATTEMPTS : Number(row.max_attempts),
    available_at: row.available_at ? String(row.available_at) : undefined,
    last_attempt_at: row.last_attempt_at ? String(row.last_attempt_at) : undefined,
    leased_until: row.leased_until ? String(row.leased_until) : undefined,
    last_error: row.last_error ? String(row.last_error) : undefined,
  };
}

export const jobRepository: AnalysisJobRepository = {
  mode: "read-write",
  save(job: AnalysisJob & { available_at?: string; last_attempt_at?: string }): AnalysisJob {
    const now = new Date().toISOString();
    getDb()
      .prepare(
        `INSERT INTO analysis_jobs (job_id, analysis_id, account_id, job_type, status, progress_pct, current_step, error_code, error_message, created_at, updated_at, started_at, finished_at, retry_count, attempts, max_attempts, available_at, last_attempt_at, leased_until, last_error)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
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
        job.updated_at ?? now,
        job.started_at ?? null,
        job.finished_at ?? null,
        job.retry_count,
        job.attempts ?? job.retry_count ?? 0,
        job.max_attempts ?? DEFAULT_MAX_ATTEMPTS,
        job.available_at ?? job.created_at,
        job.last_attempt_at ?? null,
        job.leased_until ?? null,
        job.last_error ?? null,
      );
    return job;
  },
  findByAnalysisId(analysisId: string): (AnalysisJob & { available_at?: string; last_attempt_at?: string }) | undefined {
    const row = getDb().prepare("SELECT * FROM analysis_jobs WHERE analysis_id = ?").get(analysisId) as Record<string, unknown> | undefined;
    return row ? mapRow(row) : undefined;
  },
  findById(jobId: string): AnalysisJob | undefined {
    const row = getDb().prepare("SELECT * FROM analysis_jobs WHERE job_id = ?").get(jobId) as Record<string, unknown> | undefined;
    return row ? mapRow(row) : undefined;
  },
  updateByAnalysisId(
    analysisId: string,
    updater: (current: AnalysisJob & { available_at?: string; last_attempt_at?: string }) => AnalysisJob & { available_at?: string; last_attempt_at?: string },
  ): (AnalysisJob & { available_at?: string; last_attempt_at?: string }) | undefined {
    const current = this.findByAnalysisId(analysisId);
    if (!current) return undefined;
    const next = updater(current);
    const now = new Date().toISOString();
    getDb()
      .prepare(
        `UPDATE analysis_jobs SET status=?, progress_pct=?, current_step=?, error_code=?, error_message=?, updated_at=?, started_at=?, finished_at=?, retry_count=?, attempts=?, max_attempts=?, available_at=?, last_attempt_at=?, leased_until=?, last_error=? WHERE analysis_id=?`,
      )
      .run(
        next.status,
        next.progress_pct ?? null,
        next.current_step ?? null,
        next.error_code ?? null,
        next.error_message ?? null,
        next.updated_at ?? now,
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
      );
    return next;
  },
  claimNextQueued(nowIso: string, options?: { leaseMs?: number; workerId?: string }): AnalysisJob | undefined {
    const db = getDb();
    const leaseUntil = new Date(Date.parse(nowIso) + (options?.leaseMs ?? 5 * 60 * 1000)).toISOString();
    db.exec("BEGIN IMMEDIATE");
    try {
      const row = db
        .prepare(
          `SELECT * FROM analysis_jobs
           WHERE (
             status = 'queued'
             OR (status IN ('processing', 'running') AND leased_until IS NOT NULL AND leased_until <= ?)
             OR (status = 'failed' AND retry_count < COALESCE(max_attempts, ?))
           )
           AND COALESCE(available_at, created_at) <= ?
           ORDER BY created_at ASC
           LIMIT 1`,
        )
        .get(nowIso, DEFAULT_MAX_ATTEMPTS, nowIso) as Record<string, unknown> | undefined;
      if (!row) {
        db.exec("COMMIT");
        return undefined;
      }
      const claimed = mapRow(row);
      const nextAttempts = (claimed.attempts ?? claimed.retry_count ?? 0) + 1;
      db.prepare(
        `UPDATE analysis_jobs
         SET status = 'processing',
             started_at = COALESCE(started_at, ?),
             updated_at = ?,
             last_attempt_at = ?,
             leased_until = ?,
             attempts = ?,
             current_step = 'Starting analysis',
             progress_pct = 5
         WHERE job_id = ?`,
      ).run(nowIso, nowIso, nowIso, leaseUntil, nextAttempts, claimed.job_id);
      db.exec("COMMIT");
      return this.findById(claimed.job_id);
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  },
  listFailed(limit = 50): AnalysisJob[] {
    const rows = getDb()
      .prepare("SELECT * FROM analysis_jobs WHERE status = 'failed' ORDER BY COALESCE(finished_at, updated_at, created_at) DESC LIMIT ?")
      .all(limit) as Record<string, unknown>[];
    return rows.map(mapRow);
  },
  listDeadLetters(limit = 50): AnalysisJob[] {
    const rows = getDb()
      .prepare("SELECT * FROM analysis_jobs WHERE status = 'dead_letter' ORDER BY COALESCE(finished_at, updated_at, created_at) DESC LIMIT ?")
      .all(limit) as Record<string, unknown>[];
    return rows.map(mapRow);
  },
};
