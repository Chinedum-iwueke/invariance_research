import { getHealthSnapshot } from "@/lib/server/ops/health-service";

export async function getAdminHealthSnapshot() {
  const snapshot = await getHealthSnapshot();
  const engineProbe = snapshot.checks.find((check) => check.name === "engine_probe");
  const queue = snapshot.checks.find((check) => check.name === "queue");
  const analysisWorker = snapshot.checks.find((check) => check.name === "analysis_worker");
  const exportWorker = snapshot.checks.find((check) => check.name === "export_worker");
  return {
    ...snapshot,
    startup_validation_state: snapshot.status,
    engine_version: engineProbe?.detail?.startsWith("version=") ? engineProbe.detail.replace("version=", "") : "unknown",
    queue_backlog: queue?.meta,
    workers: {
      analysis: analysisWorker?.status ?? "degraded",
      export: exportWorker?.status ?? "degraded",
    },
  };
}
