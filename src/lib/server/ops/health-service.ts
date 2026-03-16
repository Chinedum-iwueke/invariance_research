import { runStartupValidation } from "@/lib/server/ops/startup-validation";

export async function getHealthSnapshot() {
  const checks = await runStartupValidation();
  const ok = checks.every((c) => c.ok);
  return {
    ok,
    timestamp: new Date().toISOString(),
    checks,
  };
}
