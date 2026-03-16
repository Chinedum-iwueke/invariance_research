import { getDb } from "@/lib/server/persistence/database";
import { getObjectStorage } from "@/lib/server/storage/object-storage";
import { loadBulletproofModule } from "@/lib/server/engine/bulletproof-client";
import { logger } from "@/lib/server/ops/logger";

export type StartupCheck = { name: string; ok: boolean; detail?: string };

export async function runStartupValidation(): Promise<StartupCheck[]> {
  const checks: StartupCheck[] = [];

  try {
    getDb().prepare("SELECT 1").get();
    checks.push({ name: "database", ok: true });
  } catch (error) {
    checks.push({ name: "database", ok: false, detail: error instanceof Error ? error.message : "db_error" });
  }

  try {
    const test = getObjectStorage().putObject({ bucket: "exports", file_name: "healthcheck.txt", content_type: "text/plain", bytes: new Uint8Array(Buffer.from("ok")) });
    getObjectStorage().deleteObject(test.storage_key);
    checks.push({ name: "storage", ok: true });
  } catch (error) {
    checks.push({ name: "storage", ok: false, detail: error instanceof Error ? error.message : "storage_error" });
  }

  const stripeOk = Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
  checks.push({ name: "stripe_config", ok: stripeOk, detail: stripeOk ? undefined : "Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET" });

  try {
    const bt = await loadBulletproofModule();
    const seam = typeof bt.run_analysis_from_parsed_artifact === "function";
    checks.push({ name: "engine_import", ok: true, detail: bt.__version__ ? `version=${bt.__version__}` : "version_unavailable" });
    checks.push({ name: "engine_seam", ok: seam, detail: seam ? "run_analysis_from_parsed_artifact available" : "seam_missing" });
  } catch (error) {
    checks.push({ name: "engine_import", ok: false, detail: error instanceof Error ? error.message : "engine_import_error" });
    checks.push({ name: "engine_seam", ok: false, detail: "engine_not_loaded" });
  }

  // queue is DB-backed in Phase 7A/7B
  checks.push({ name: "queue", ok: true, detail: "db_backed_queue" });
  logger.info("startup.validation.completed", { checks });
  return checks;
}

export async function assertStartupReady() {
  const checks = await runStartupValidation();
  const failures = checks.filter((c) => !c.ok);
  if (failures.length > 0) {
    const summary = failures.map((f) => `${f.name}:${f.detail ?? "failed"}`).join(", ");
    throw new Error(`startup_validation_failed:${summary}`);
  }
  return checks;
}
