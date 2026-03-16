import { cleanupExpiredExports, cleanupStaleFailedJobs, runMaintenanceSweep } from "@/lib/server/maintenance/retention-service";

export function runAdminMaintenanceAction(action: "sweep" | "expired_exports" | "stale_failed_jobs") {
  if (action === "sweep") return runMaintenanceSweep();
  if (action === "expired_exports") return cleanupExpiredExports();
  return cleanupStaleFailedJobs();
}
