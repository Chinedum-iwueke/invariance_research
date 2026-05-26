import type { ExportJob } from "@/lib/server/exports/models";
import { getDb } from "@/lib/server/persistence/database";
import { getDatabaseProvider } from "@/lib/server/persistence/provider";
import { getPostgresPool } from "@/lib/server/persistence/postgres";

function iso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

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
    created_at: iso(row.created_at),
    started_at: row.started_at ? iso(row.started_at) : undefined,
    finished_at: row.finished_at ? iso(row.finished_at) : undefined,
    available_at: row.available_at ? iso(row.available_at) : undefined,
    last_attempt_at: row.last_attempt_at ? iso(row.last_attempt_at) : undefined,
  };
}

export const exportJobRepository = {
  save(job: ExportJob): ExportJob | Promise<ExportJob> {
    if (getDatabaseProvider() === "postgres") {
      return getPostgresPool()
        .query(
          `INSERT INTO export_jobs (export_job_id, export_id, analysis_id, account_id, status, format, progress_pct, current_step, error_code, error_message, retry_count, created_at, started_at, finished_at, available_at, last_attempt_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
          [
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
          ],
        )
        .then(() => job);
    }
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
  findByExportId(exportId: string): ExportJob | undefined | Promise<ExportJob | undefined> {
    if (getDatabaseProvider() === "postgres") {
      return getPostgresPool().query("SELECT * FROM export_jobs WHERE export_id = $1", [exportId]).then((result) => result.rows[0] ? mapRow(result.rows[0]) : undefined);
    }
    const row = getDb().prepare("SELECT * FROM export_jobs WHERE export_id = ?").get(exportId) as Record<string, unknown> | undefined;
    return row ? mapRow(row) : undefined;
  },
  async updateByExportId(exportId: string, updater: (current: ExportJob) => ExportJob): Promise<ExportJob | undefined> {
    const current = await this.findByExportId(exportId);
    if (!current) return undefined;
    const next = updater(current);
    if (getDatabaseProvider() === "postgres") {
      await getPostgresPool().query(
        `UPDATE export_jobs
         SET status=$1, progress_pct=$2, current_step=$3, error_code=$4, error_message=$5, retry_count=$6, started_at=$7, finished_at=$8, available_at=$9, last_attempt_at=$10
         WHERE export_id=$11`,
        [
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
        ],
      );
      return next;
    }
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
  async claimNextQueued(nowIso: string): Promise<ExportJob | undefined> {
    if (getDatabaseProvider() === "postgres") {
      const result = await getPostgresPool().query<Record<string, unknown>>(
        `UPDATE export_jobs
         SET status='processing', started_at=COALESCE(started_at, $1), last_attempt_at=$1, current_step='Starting export', progress_pct=5
         WHERE export_job_id = (
           SELECT export_job_id FROM export_jobs
           WHERE status='queued' AND COALESCE(available_at, created_at) <= $1
           ORDER BY created_at ASC
           LIMIT 1
           FOR UPDATE SKIP LOCKED
         )
         RETURNING *`,
        [nowIso],
      );
      return result.rows[0] ? mapRow(result.rows[0]) : undefined;
    }
    const row = getDb().prepare("SELECT * FROM export_jobs WHERE status='queued' AND COALESCE(available_at, created_at) <= ? ORDER BY created_at ASC LIMIT 1").get(nowIso) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    const claimed = mapRow(row);
    await this.updateByExportId(claimed.export_id, (current) => ({ ...current, status: "processing", started_at: current.started_at ?? nowIso, last_attempt_at: nowIso, current_step: "Starting export", progress_pct: 5 }));
    return await this.findByExportId(claimed.export_id);
  },
};
