import { logger } from "@/lib/server/ops/logger";
import { exportRepository } from "@/lib/server/repositories/export-repository";
import { getObjectStorage } from "@/lib/server/storage/object-storage";
import { getDb } from "@/lib/server/persistence/database";

export function cleanupExpiredExports(now = new Date()) {
  const expired = exportRepository.listExpired(now.toISOString());
  let removed = 0;
  for (const item of expired) {
    if (item.storage_key && getObjectStorage().objectExists(item.storage_key)) {
      getObjectStorage().deleteObject(item.storage_key);
    }
    exportRepository.delete(item.export_id);
    removed += 1;
  }
  logger.info("maintenance.cleanup_expired_exports", { removed });
  return { removed };
}

export function cleanupStaleFailedJobs(now = new Date()) {
  const cutoff = new Date(now.getTime() - 3 * 86_400_000).toISOString();
  const db = getDb();
  const analysis = db.prepare("DELETE FROM analysis_jobs WHERE status = 'failed' AND finished_at IS NOT NULL AND finished_at < ?").run(cutoff);
  const exports = db.prepare("DELETE FROM export_jobs WHERE status = 'failed' AND finished_at IS NOT NULL AND finished_at < ?").run(cutoff);
  const removed = Number(analysis.changes ?? 0) + Number(exports.changes ?? 0);
  logger.info("maintenance.cleanup_stale_failed_jobs", { removed });
  return { removed };
}

export function runMaintenanceSweep() {
  const expired = cleanupExpiredExports();
  const stale = cleanupStaleFailedJobs();
  return { expired_exports_removed: expired.removed, stale_jobs_removed: stale.removed };
}
