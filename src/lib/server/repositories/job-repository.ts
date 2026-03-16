import type { AnalysisJob } from "@/lib/server/analysis/models";
import { getDb } from "@/lib/server/persistence/database";

function mapRow(row: Record<string, unknown>): AnalysisJob {
  return {
    job_id: String(row.job_id),
    analysis_id: String(row.analysis_id),
    job_type: row.job_type as AnalysisJob["job_type"],
    status: row.status as AnalysisJob["status"],
    progress_pct: row.progress_pct === null ? undefined : Number(row.progress_pct),
    current_step: row.current_step ? String(row.current_step) : undefined,
    error_code: row.error_code ? String(row.error_code) : undefined,
    error_message: row.error_message ? String(row.error_message) : undefined,
    created_at: String(row.created_at),
    started_at: row.started_at ? String(row.started_at) : undefined,
    finished_at: row.finished_at ? String(row.finished_at) : undefined,
    retry_count: Number(row.retry_count),
    available_at: row.available_at ? String(row.available_at) : undefined,
    last_attempt_at: row.last_attempt_at ? String(row.last_attempt_at) : undefined,
  };
}

export const jobRepository = {
  save(job: AnalysisJob & { available_at?: string; last_attempt_at?: string }): AnalysisJob {
    getDb()
      .prepare(
        `INSERT INTO analysis_jobs (job_id, analysis_id, job_type, status, progress_pct, current_step, error_code, error_message, created_at, started_at, finished_at, retry_count, available_at, last_attempt_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        job.job_id,
        job.analysis_id,
        job.job_type,
        job.status,
        job.progress_pct ?? null,
        job.current_step ?? null,
        job.error_code ?? null,
        job.error_message ?? null,
        job.created_at,
        job.started_at ?? null,
        job.finished_at ?? null,
        job.retry_count,
        job.available_at ?? job.created_at,
        job.last_attempt_at ?? null,
      );
    return job;
  },
  findByAnalysisId(analysisId: string): (AnalysisJob & { available_at?: string; last_attempt_at?: string }) | undefined {
    const row = getDb().prepare("SELECT * FROM analysis_jobs WHERE analysis_id = ?").get(analysisId) as Record<string, unknown> | undefined;
    return row ? mapRow(row) : undefined;
  },
  updateByAnalysisId(
    analysisId: string,
    updater: (current: AnalysisJob & { available_at?: string; last_attempt_at?: string }) => AnalysisJob & { available_at?: string; last_attempt_at?: string },
  ): (AnalysisJob & { available_at?: string; last_attempt_at?: string }) | undefined {
    const current = this.findByAnalysisId(analysisId);
    if (!current) return undefined;
    const next = updater(current);
    getDb()
      .prepare(
        `UPDATE analysis_jobs SET status=?, progress_pct=?, current_step=?, error_code=?, error_message=?, started_at=?, finished_at=?, retry_count=?, available_at=?, last_attempt_at=? WHERE analysis_id=?`,
      )
      .run(
        next.status,
        next.progress_pct ?? null,
        next.current_step ?? null,
        next.error_code ?? null,
        next.error_message ?? null,
        next.started_at ?? null,
        next.finished_at ?? null,
        next.retry_count,
        next.available_at ?? null,
        next.last_attempt_at ?? null,
        analysisId,
      );
    return next;
  },
  claimNextQueued(nowIso: string): (AnalysisJob & { available_at?: string; last_attempt_at?: string }) | undefined {
    const row = getDb()
      .prepare(
        `SELECT * FROM analysis_jobs
         WHERE status = 'queued' AND COALESCE(available_at, created_at) <= ?
         ORDER BY created_at ASC
         LIMIT 1`,
      )
      .get(nowIso) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    const claimed = mapRow(row);
    this.updateByAnalysisId(claimed.analysis_id, (current) => ({
      ...current,
      status: "processing",
      started_at: current.started_at ?? nowIso,
      last_attempt_at: nowIso,
      current_step: "Starting analysis",
      progress_pct: 5,
    }));
    return this.findByAnalysisId(claimed.analysis_id);
  },
};
