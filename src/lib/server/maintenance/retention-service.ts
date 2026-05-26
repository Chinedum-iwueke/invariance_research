import { logger } from "@/lib/server/ops/logger";
import { exportRepository } from "@/lib/server/repositories/export-repository";
import { getObjectStorage } from "@/lib/server/storage/object-storage";
import { getSqliteRuntimeDb } from "@/lib/server/persistence/sqlite-runtime";

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

export function cleanupStaleFailedJobs(now = new Date()) {
  const cutoff = new Date(now.getTime() - 3 * 86_400_000).toISOString();
  const db = getSqliteRuntimeDb();
  const analysis = db.prepare("DELETE FROM analysis_jobs WHERE status = 'failed' AND finished_at IS NOT NULL AND finished_at < ?").run(cutoff);
  const exports = db.prepare("DELETE FROM export_jobs WHERE status = 'failed' AND finished_at IS NOT NULL AND finished_at < ?").run(cutoff);
  const removed = Number(analysis.changes ?? 0) + Number(exports.changes ?? 0);
  logger.info("maintenance.cleanup_stale_failed_jobs", { removed });
  return { removed };
}

export function cleanupShareAccessEvents(now = new Date(), retentionDays = 90) {
  const cutoff = new Date(now.getTime() - retentionDays * 86_400_000).toISOString();
  const result = getSqliteRuntimeDb().prepare("DELETE FROM share_access_events WHERE created_at < ?").run(cutoff);
  const removed = Number(result.changes ?? 0);
  logger.info("maintenance.cleanup_share_access_events", { removed, retention_days: retentionDays });
  return { removed };
}

export async function runMaintenanceSweep() {
  const expired = await cleanupExpiredExports();
  const stale = cleanupStaleFailedJobs();
  const shareAccess = cleanupShareAccessEvents();
  return { expired_exports_removed: expired.removed, stale_jobs_removed: stale.removed, share_access_events_removed: shareAccess.removed };
}
