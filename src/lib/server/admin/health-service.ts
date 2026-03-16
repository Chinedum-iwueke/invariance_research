import { getHealthSnapshot } from "@/lib/server/ops/health-service";
import { runStartupValidation } from "@/lib/server/ops/startup-validation";

export async function getAdminHealthSnapshot() {
  const snapshot = await getHealthSnapshot();
  const checks = await runStartupValidation();
  const engineImport = checks.find((check) => check.name === "engine_import");
  return {
    ...snapshot,
    startup_validation_state: snapshot.ok ? "ready" : "degraded",
    engine_version: engineImport?.detail?.startsWith("version=") ? engineImport.detail.replace("version=", "") : "unknown",
  };
}
