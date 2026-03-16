import { getDb } from "@/lib/server/persistence/database";
import { retryAnalysis } from "@/lib/server/services/analysis-service";
import { exportQueue } from "@/lib/server/queue/export-queue";
import { exportJobRepository } from "@/lib/server/repositories/export-job-repository";
import { exportRepository } from "@/lib/server/repositories/export-repository";

export type AdminJobView = {
  kind: "analysis" | "export";
  job_id: string;
  linked_id: string;
  status: string;
  job_type: string;
  current_step?: string;
  progress_pct?: number;
  retry_count: number;
  available_at?: string;
  last_attempt_at?: string;
  created_at: string;
  updated_at: string;
  error_code?: string;
  error_summary?: string;
};

export function listAdminJobs(filters: { status?: string; type?: "analysis" | "export" } = {}) {
  const db = getDb();
  const analysisRows = (db
    .prepare(`SELECT 'analysis' as kind, job_id, analysis_id as linked_id, status, job_type, current_step, progress_pct, retry_count, available_at, last_attempt_at, created_at, COALESCE(finished_at, started_at, created_at) as updated_at, error_code, error_message as error_summary FROM analysis_jobs`)
    .all() ?? []) as Record<string, unknown>[];
  const exportRows = (db
    .prepare(`SELECT 'export' as kind, export_job_id as job_id, export_id as linked_id, status, 'export_render' as job_type, current_step, progress_pct, retry_count, available_at, last_attempt_at, created_at, COALESCE(finished_at, started_at, created_at) as updated_at, error_code, error_message as error_summary FROM export_jobs`)
    .all() ?? []) as Record<string, unknown>[];

  const rows = [...analysisRows, ...exportRows]
    .map((row) => ({
      kind: row.kind as "analysis" | "export",
      job_id: String(row.job_id),
      linked_id: String(row.linked_id),
      status: String(row.status),
      job_type: String(row.job_type),
      current_step: row.current_step ? String(row.current_step) : undefined,
      progress_pct: row.progress_pct === null ? undefined : Number(row.progress_pct),
      retry_count: Number(row.retry_count ?? 0),
      available_at: row.available_at ? String(row.available_at) : undefined,
      last_attempt_at: row.last_attempt_at ? String(row.last_attempt_at) : undefined,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
      error_code: row.error_code ? String(row.error_code) : undefined,
      error_summary: row.error_summary ? String(row.error_summary) : undefined,
    }))
    .filter((row) => (filters.type ? row.kind === filters.type : true))
    .filter((row) => (filters.status ? row.status === filters.status : true))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const staleCutoff = Date.now() - 60 * 60 * 1000;
  const summary = {
    total: rows.length,
    queued: rows.filter((job) => job.status === "queued").length,
    processing: rows.filter((job) => job.status === "processing").length,
    failed: rows.filter((job) => job.status === "failed").length,
    stale: rows.filter((job) => ["queued", "processing"].includes(job.status) && Date.parse(job.created_at) < staleCutoff).length,
  };

  return { rows, summary, recentFailures: rows.filter((job) => job.status === "failed").slice(0, 10) };
}

export function retryAdminJob(input: { kind: "analysis" | "export"; linked_id: string }) {
  if (input.kind === "analysis") {
    const retried = retryAnalysis(input.linked_id);
    if (!retried) throw new Error("retry_not_allowed");
    return { ok: true, kind: "analysis", linked_id: input.linked_id };
  }

  const job = exportJobRepository.findByExportId(input.linked_id);
  const record = exportRepository.findById(input.linked_id);
  if (!job || !record || record.status !== "failed") {
    throw new Error("retry_not_allowed");
  }

  exportRepository.update(input.linked_id, (current) => ({
    ...current,
    status: "queued",
    error_code: undefined,
    error_message: undefined,
    updated_at: new Date().toISOString(),
  }));
  exportQueue.enqueueRetry(input.linked_id, job.retry_count + 1);
  return { ok: true, kind: "export", linked_id: input.linked_id };
}
