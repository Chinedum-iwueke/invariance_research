import { getHealthSnapshot } from "@/lib/server/ops/health-service";

export async function getAdminHealthSnapshot() {
  const snapshot = await getHealthSnapshot();
  const engineImport = snapshot.checks.find((check) => check.name === "engine_import");
  const queue = snapshot.checks.find((check) => check.name === "queue");
  const analysisWorker = snapshot.checks.find((check) => check.name === "analysis_worker");
  const exportWorker = snapshot.checks.find((check) => check.name === "export_worker");
  return {
    ...snapshot,
    startup_validation_state: snapshot.status,
    engine_version: engineImport?.detail?.startsWith("version=") ? engineImport.detail.replace("version=", "") : "unknown",
    queue_backlog: queue?.meta,
    workers: {
      analysis: analysisWorker?.status ?? "degraded",
      export: exportWorker?.status ?? "degraded",
    },
  };
}
