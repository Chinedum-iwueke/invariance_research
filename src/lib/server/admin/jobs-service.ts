import { randomUUID } from "node:crypto";
import { getSqliteRuntimeDb } from "@/lib/server/persistence/sqlite-runtime";
import { getDatabaseProvider } from "@/lib/server/persistence/provider";
import { getPostgresPool } from "@/lib/server/persistence/postgres";
import { retryAnalysis } from "@/lib/server/services/analysis-service";
import { researchProgramRepository } from "@/lib/server/research-programs/repository";
import { exportQueue } from "@/lib/server/queue/export-queue";
import { exportJobRepository } from "@/lib/server/repositories/export-job-repository";
import { exportRepository } from "@/lib/server/repositories/export-repository";

export type AdminJobView = {
  kind: "analysis" | "export" | "experiment";
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

function iso(value: unknown) {
  return value instanceof Date ? value.toISOString() : String(value);
}

async function readAdminJobRows() {
  if (getDatabaseProvider() === "postgres") {
    const pool = getPostgresPool();
    const [analysisRows, exportRows, experimentRows] = await Promise.all([
      pool.query<Record<string, unknown>>(
        `SELECT 'analysis' as kind, job_id, analysis_id as linked_id, status, job_type, current_step, progress_pct, retry_count, available_at, last_attempt_at, created_at, COALESCE(finished_at, started_at, updated_at, created_at) as updated_at, error_code, error_message as error_summary FROM analysis_jobs`,
      ),
      pool.query<Record<string, unknown>>(
        `SELECT 'export' as kind, export_job_id as job_id, export_id as linked_id, status, 'export_render' as job_type, current_step, progress_pct, retry_count, available_at, last_attempt_at, created_at, COALESCE(finished_at, started_at, created_at) as updated_at, error_code, error_message as error_summary FROM export_jobs`,
      ),
      pool.query<Record<string, unknown>>(
        `SELECT 'experiment' as kind, experiment_job_id as job_id, experiment_job_id as linked_id, status, 'research_experiment' as job_type, current_step, progress_pct, retry_count, available_at, updated_at as last_attempt_at, created_at, updated_at, NULL as error_code, last_error as error_summary FROM experiment_jobs`,
      ),
    ]);
    return [...analysisRows.rows, ...exportRows.rows, ...experimentRows.rows];
  }

  const db = getSqliteRuntimeDb();
  const analysisRows = (db
    .prepare(`SELECT 'analysis' as kind, job_id, analysis_id as linked_id, status, job_type, current_step, progress_pct, retry_count, available_at, last_attempt_at, created_at, COALESCE(finished_at, started_at, created_at) as updated_at, error_code, error_message as error_summary FROM analysis_jobs`)
    .all() ?? []) as Record<string, unknown>[];
  const exportRows = (db
    .prepare(`SELECT 'export' as kind, export_job_id as job_id, export_id as linked_id, status, 'export_render' as job_type, current_step, progress_pct, retry_count, available_at, last_attempt_at, created_at, COALESCE(finished_at, started_at, created_at) as updated_at, error_code, error_message as error_summary FROM export_jobs`)
    .all() ?? []) as Record<string, unknown>[];
  const experimentRows = (db
    .prepare(`SELECT 'experiment' as kind, experiment_job_id as job_id, experiment_job_id as linked_id, status, 'research_experiment' as job_type, current_step, progress_pct, retry_count, available_at, updated_at as last_attempt_at, created_at, updated_at, NULL as error_code, last_error as error_summary FROM experiment_jobs`)
    .all() ?? []) as Record<string, unknown>[];
  return [...analysisRows, ...exportRows, ...experimentRows];
}

export async function listAdminJobs(filters: { status?: string; type?: "analysis" | "export" | "experiment" } = {}) {
  const rows = (await readAdminJobRows())
    .map((row) => ({
      kind: row.kind as "analysis" | "export" | "experiment",
      job_id: String(row.job_id),
      linked_id: String(row.linked_id),
      status: String(row.status),
      job_type: String(row.job_type),
      current_step: row.current_step ? String(row.current_step) : undefined,
      progress_pct: row.progress_pct === null ? undefined : Number(row.progress_pct),
      retry_count: Number(row.retry_count ?? 0),
      available_at: row.available_at ? iso(row.available_at) : undefined,
      last_attempt_at: row.last_attempt_at ? iso(row.last_attempt_at) : undefined,
      created_at: iso(row.created_at),
      updated_at: iso(row.updated_at),
      error_code: row.error_code ? String(row.error_code) : undefined,
      error_summary: row.error_summary ? String(row.error_summary) : undefined,
    }))
    .filter((row) => (filters.type ? row.kind === filters.type : true))
    .filter((row) => (filters.status ? row.status === filters.status : true))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const staleCutoff = Date.now() - 60 * 60 * 1000;
  const processingCutoff = Date.now() - 30 * 60 * 1000;
  const summary = {
    total: rows.length,
    queued: rows.filter((job) => job.status === "queued").length,
    processing: rows.filter((job) => job.status === "processing").length,
    failed: rows.filter((job) => job.status === "failed").length,
    dead_letter: rows.filter((job) => job.status === "dead_letter").length,
    stale: rows.filter((job) => ["queued", "processing"].includes(job.status) && Date.parse(job.updated_at) < staleCutoff).length,
    overdue_processing: rows.filter((job) => job.status === "processing" && Date.parse(job.updated_at) < processingCutoff).length,
  };

  return { rows, summary, recentFailures: rows.filter((job) => job.status === "failed").slice(0, 10) };
}

export async function retryAdminJob(input: { kind: "analysis" | "export" | "experiment"; linked_id: string }) {
  if (input.kind === "analysis") {
    const retried = await retryAnalysis(input.linked_id);
    if (!retried) throw new Error("retry_not_allowed");
    return { ok: true, kind: "analysis", linked_id: input.linked_id };
  }

  if (input.kind === "experiment") {
    const job = await researchProgramRepository.findExperimentJob(input.linked_id);
    if (!job || job.status !== "failed") throw new Error("retry_not_allowed");
    await researchProgramRepository.updateExperimentJob({
      job_id: job.experiment_job_id,
      account_id: job.account_id,
      patch: {
        status: "queued",
        retry_count: job.retry_count + 1,
        current_step: "Queued for admin retry",
        available_at: new Date().toISOString(),
        last_error: undefined,
      },
      event: {
        experiment_job_event_id: randomUUID(),
        experiment_job_id: job.experiment_job_id,
        experiment_plan_id: job.experiment_plan_id,
        program_id: job.program_id,
        account_id: job.account_id,
        event_type: "retried",
        message: "Experiment job queued for admin retry.",
        payload: { retry_count: job.retry_count + 1 },
        created_at: new Date().toISOString(),
      },
    });
    return { ok: true, kind: "experiment", linked_id: input.linked_id };
  }

  const job = await exportJobRepository.findByExportId(input.linked_id);
  const record = await exportRepository.findById(input.linked_id);
  if (!job || !record || record.status !== "failed") {
    throw new Error("retry_not_allowed");
  }

  await exportRepository.update(input.linked_id, (current) => ({
    ...current,
    status: "queued",
    error_code: undefined,
    error_message: undefined,
    updated_at: new Date().toISOString(),
  }));
  await exportQueue.enqueueRetry(input.linked_id, job.retry_count + 1);
  return { ok: true, kind: "export", linked_id: input.linked_id };
}
