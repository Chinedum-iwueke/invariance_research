import { cleanupExpiredExports, cleanupShareAccessEvents, cleanupStaleFailedJobs, runMaintenanceSweep } from "@/lib/server/maintenance/retention-service";

export function runAdminMaintenanceAction(action: "sweep" | "expired_exports" | "stale_failed_jobs" | "share_access_events") {
  if (action === "sweep") return runMaintenanceSweep();
  if (action === "expired_exports") return cleanupExpiredExports();
  if (action === "share_access_events") return cleanupShareAccessEvents();
  return cleanupStaleFailedJobs();
}
