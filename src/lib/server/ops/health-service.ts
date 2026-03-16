import { runStartupValidation, type HealthLevel } from "@/lib/server/ops/startup-validation";

export async function getHealthSnapshot() {
  const checks = await runStartupValidation();
  const status = summarizeStatus(checks.map((check) => check.status));
  return {
    ok: status !== "unhealthy",
    status,
    timestamp: new Date().toISOString(),
    checks,
  };
}

function summarizeStatus(levels: HealthLevel[]): HealthLevel {
  if (levels.includes("unhealthy")) return "unhealthy";
  if (levels.includes("degraded")) return "degraded";
  return "healthy";
}
