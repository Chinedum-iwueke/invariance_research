import { logger } from "@/lib/server/ops/logger";
import { exportRepository } from "@/lib/server/repositories/export-repository";
import { getObjectStorage } from "@/lib/server/storage/object-storage";
import { getSqliteRuntimeDb } from "@/lib/server/persistence/sqlite-runtime";
import { getDatabaseProvider } from "@/lib/server/persistence/provider";
import { getPostgresPool } from "@/lib/server/persistence/postgres";

export async function cleanupExpiredExports(now = new Date()) {
  const expired = await exportRepository.listExpired(now.toISOString());
  let removed = 0;
  for (const item of expired) {
    if (item.storage_key && await getObjectStorage().objectExists(item.storage_key)) {
      await getObjectStorage().deleteObject(item.storage_key);
    }
    await exportRepository.delete(item.export_id);
    removed += 1;
  }
  logger.info("maintenance.cleanup_expired_exports", { removed });
  return { removed };
}

export async function cleanupStaleFailedJobs(now = new Date()) {
  const cutoff = new Date(now.getTime() - 3 * 86_400_000).toISOString();
  if (getDatabaseProvider() === "postgres") {
    const [analysis, exports, experiments] = await Promise.all([
      getPostgresPool().query("DELETE FROM analysis_jobs WHERE status = 'failed' AND finished_at IS NOT NULL AND finished_at < $1", [cutoff]),
      getPostgresPool().query("DELETE FROM export_jobs WHERE status = 'failed' AND finished_at IS NOT NULL AND finished_at < $1", [cutoff]),
      getPostgresPool().query("DELETE FROM experiment_jobs WHERE status = 'failed' AND finished_at IS NOT NULL AND finished_at < $1", [cutoff]),
    ]);
    const removed = Number(analysis.rowCount ?? 0) + Number(exports.rowCount ?? 0) + Number(experiments.rowCount ?? 0);
    logger.info("maintenance.cleanup_stale_failed_jobs", { removed, provider: "postgres" });
    return { removed };
  }

  const db = getSqliteRuntimeDb();
  const analysis = db.prepare("DELETE FROM analysis_jobs WHERE status = 'failed' AND finished_at IS NOT NULL AND finished_at < ?").run(cutoff);
  const exports = db.prepare("DELETE FROM export_jobs WHERE status = 'failed' AND finished_at IS NOT NULL AND finished_at < ?").run(cutoff);
  const experiments = db.prepare("DELETE FROM experiment_jobs WHERE status = 'failed' AND finished_at IS NOT NULL AND finished_at < ?").run(cutoff);
  const removed = Number(analysis.changes ?? 0) + Number(exports.changes ?? 0) + Number(experiments.changes ?? 0);
  logger.info("maintenance.cleanup_stale_failed_jobs", { removed, provider: "sqlite" });
  return { removed };
}

export async function cleanupShareAccessEvents(now = new Date(), retentionDays = 90) {
  const cutoff = new Date(now.getTime() - retentionDays * 86_400_000).toISOString();
  if (getDatabaseProvider() === "postgres") {
    const result = await getPostgresPool().query("DELETE FROM share_access_events WHERE created_at < $1", [cutoff]);
    const removed = Number(result.rowCount ?? 0);
    logger.info("maintenance.cleanup_share_access_events", { removed, retention_days: retentionDays, provider: "postgres" });
    return { removed };
  }

  const result = getSqliteRuntimeDb().prepare("DELETE FROM share_access_events WHERE created_at < ?").run(cutoff);
  const removed = Number(result.changes ?? 0);
  logger.info("maintenance.cleanup_share_access_events", { removed, retention_days: retentionDays, provider: "sqlite" });
  return { removed };
}

export async function recoverStaleProcessingJobs(now = new Date(), staleMinutes = 30) {
  const cutoff = new Date(now.getTime() - staleMinutes * 60_000).toISOString();
  const availableAt = now.toISOString();

  if (getDatabaseProvider() === "postgres") {
    const [analysis, exports, experiments] = await Promise.all([
      getPostgresPool().query(
        `UPDATE analysis_jobs
         SET status='queued', current_step='Recovered from stale processing by maintenance', available_at=$1, started_at=NULL, progress_pct=0, retry_count=retry_count + 1
         WHERE status='processing' AND COALESCE(last_attempt_at, started_at, created_at) < $2 AND retry_count < max_attempts`,
        [availableAt, cutoff],
      ),
      getPostgresPool().query(
        `UPDATE export_jobs
         SET status='queued', current_step='Recovered from stale processing by maintenance', available_at=$1, started_at=NULL, progress_pct=0, retry_count=retry_count + 1
         WHERE status='processing' AND COALESCE(last_attempt_at, started_at, created_at) < $2 AND retry_count < 3`,
        [availableAt, cutoff],
      ),
      getPostgresPool().query(
        `UPDATE experiment_jobs
         SET status='queued', current_step='Recovered from stale processing by maintenance', available_at=$1, started_at=NULL, progress_pct=0, retry_count=retry_count + 1, updated_at=$1
         WHERE status='processing' AND updated_at < $2 AND retry_count < max_attempts`,
        [availableAt, cutoff],
      ),
    ]);
    const recovered = Number(analysis.rowCount ?? 0) + Number(exports.rowCount ?? 0) + Number(experiments.rowCount ?? 0);
    logger.info("maintenance.recover_stale_processing_jobs", { recovered, stale_minutes: staleMinutes, provider: "postgres" });
    return { recovered };
  }

  const db = getSqliteRuntimeDb();
  const analysis = db.prepare(
    `UPDATE analysis_jobs
     SET status='queued', current_step='Recovered from stale processing by maintenance', available_at=?, started_at=NULL, progress_pct=0, retry_count=retry_count + 1
     WHERE status='processing' AND COALESCE(last_attempt_at, started_at, created_at) < ? AND retry_count < max_attempts`,
  ).run(availableAt, cutoff);
  const exports = db.prepare(
    `UPDATE export_jobs
     SET status='queued', current_step='Recovered from stale processing by maintenance', available_at=?, started_at=NULL, progress_pct=0, retry_count=retry_count + 1
     WHERE status='processing' AND COALESCE(last_attempt_at, started_at, created_at) < ? AND retry_count < 3`,
  ).run(availableAt, cutoff);
  const experiments = db.prepare(
    `UPDATE experiment_jobs
     SET status='queued', current_step='Recovered from stale processing by maintenance', available_at=?, started_at=NULL, progress_pct=0, retry_count=retry_count + 1, updated_at=?
     WHERE status='processing' AND updated_at < ? AND retry_count < max_attempts`,
  ).run(availableAt, cutoff, availableAt);
  const recovered = Number(analysis.changes ?? 0) + Number(exports.changes ?? 0) + Number(experiments.changes ?? 0);
  logger.info("maintenance.recover_stale_processing_jobs", { recovered, stale_minutes: staleMinutes, provider: "sqlite" });
  return { recovered };
}

export async function runMaintenanceSweep() {
  const expired = await cleanupExpiredExports();
  const stale = await cleanupStaleFailedJobs();
  const recovered = await recoverStaleProcessingJobs();
  const shareAccess = await cleanupShareAccessEvents();
  return {
    expired_exports_removed: expired.removed,
    stale_jobs_removed: stale.removed,
    stale_processing_jobs_recovered: recovered.recovered,
    share_access_events_removed: shareAccess.removed,
  };
}
