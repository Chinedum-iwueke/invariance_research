import type { ExportJob } from "@/lib/server/exports/models";
import { getDb } from "@/lib/server/persistence/database";

function mapRow(row: Record<string, unknown>): ExportJob {
  return {
    export_job_id: String(row.export_job_id),
    export_id: String(row.export_id),
    analysis_id: String(row.analysis_id),
    account_id: String(row.account_id),
    format: row.format as ExportJob["format"],
    status: row.status as ExportJob["status"],
    progress_pct: row.progress_pct === null ? undefined : Number(row.progress_pct),
    current_step: row.current_step ? String(row.current_step) : undefined,
    error_code: row.error_code ? String(row.error_code) : undefined,
    error_message: row.error_message ? String(row.error_message) : undefined,
    retry_count: Number(row.retry_count),
    created_at: String(row.created_at),
    started_at: row.started_at ? String(row.started_at) : undefined,
    finished_at: row.finished_at ? String(row.finished_at) : undefined,
    available_at: row.available_at ? String(row.available_at) : undefined,
    last_attempt_at: row.last_attempt_at ? String(row.last_attempt_at) : undefined,
  };
}

export const exportJobRepository = {
  save(job: ExportJob) {
    getDb().prepare(`INSERT INTO export_jobs (export_job_id, export_id, analysis_id, account_id, status, format, progress_pct, current_step, error_code, error_message, retry_count, created_at, started_at, finished_at, available_at, last_attempt_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      job.export_job_id,
      job.export_id,
      job.analysis_id,
      job.account_id,
      job.status,
      job.format,
      job.progress_pct ?? null,
      job.current_step ?? null,
      job.error_code ?? null,
      job.error_message ?? null,
      job.retry_count,
      job.created_at,
      job.started_at ?? null,
      job.finished_at ?? null,
      job.available_at ?? job.created_at,
      job.last_attempt_at ?? null,
    );
    return job;
  },
  findByExportId(exportId: string) {
    const row = getDb().prepare("SELECT * FROM export_jobs WHERE export_id = ?").get(exportId) as Record<string, unknown> | undefined;
    return row ? mapRow(row) : undefined;
  },
  updateByExportId(exportId: string, updater: (current: ExportJob) => ExportJob) {
    const current = this.findByExportId(exportId);
    if (!current) return undefined;
    const next = updater(current);
    getDb().prepare("UPDATE export_jobs SET status=?, progress_pct=?, current_step=?, error_code=?, error_message=?, retry_count=?, started_at=?, finished_at=?, available_at=?, last_attempt_at=? WHERE export_id=?").run(
      next.status,
      next.progress_pct ?? null,
      next.current_step ?? null,
      next.error_code ?? null,
      next.error_message ?? null,
      next.retry_count,
      next.started_at ?? null,
      next.finished_at ?? null,
      next.available_at ?? null,
      next.last_attempt_at ?? null,
      exportId,
    );
    return next;
  },
  claimNextQueued(nowIso: string) {
    const row = getDb().prepare("SELECT * FROM export_jobs WHERE status='queued' AND COALESCE(available_at, created_at) <= ? ORDER BY created_at ASC LIMIT 1").get(nowIso) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    const claimed = mapRow(row);
    this.updateByExportId(claimed.export_id, (current) => ({ ...current, status: "processing", started_at: current.started_at ?? nowIso, last_attempt_at: nowIso, current_step: "Starting export", progress_pct: 5 }));
    return this.findByExportId(claimed.export_id);
  },
};
