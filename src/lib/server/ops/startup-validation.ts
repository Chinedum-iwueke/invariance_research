import fs from "node:fs";
import { spawnSync } from "node:child_process";

import { getDb } from "@/lib/server/persistence/database";
import { getObjectStorage } from "@/lib/server/storage/object-storage";
import { getBulletproofBridgeConfig, probeBulletproofEngine } from "@/lib/server/engine/bulletproof-client";
import { logger } from "@/lib/server/ops/logger";
import { getWorkerHeartbeatStaleMs } from "@/lib/server/queue/runtime-config";
import { workerHeartbeatRepository } from "@/lib/server/repositories/worker-heartbeat-repository";

export type HealthLevel = "healthy" | "degraded" | "unhealthy";
export type StartupCheck = { name: string; status: HealthLevel; detail?: string; meta?: Record<string, unknown> };

export async function runStartupValidation(): Promise<StartupCheck[]> {
  const checks: StartupCheck[] = [];

  try {
    getDb().prepare("SELECT 1").get();
    checks.push({ name: "database", status: "healthy" });
  } catch (error) {
    checks.push({ name: "database", status: "unhealthy", detail: error instanceof Error ? error.message : "db_error" });
  }

  try {
    const test = getObjectStorage().putObject({ bucket: "exports", file_name: "healthcheck.txt", content_type: "text/plain", bytes: new Uint8Array(Buffer.from("ok")) });
    getObjectStorage().deleteObject(test.storage_key);
    checks.push({ name: "storage", status: "healthy" });
  } catch (error) {
    checks.push({ name: "storage", status: "unhealthy", detail: error instanceof Error ? error.message : "storage_error" });
  }

  const stripeOk = Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
  checks.push({ name: "stripe_config", status: stripeOk ? "healthy" : "degraded", detail: stripeOk ? undefined : "Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET" });

  checks.push(...(await getEngineChecks()));

  checks.push(getQueueCheck());
  checks.push(getWorkerCheck("analysis"));
  checks.push(getWorkerCheck("export"));

  logger.info("startup.validation.completed", { checks });
  return checks;
}

async function getEngineChecks(): Promise<StartupCheck[]> {
  const checks: StartupCheck[] = [];
  const { pythonBin, bridgeScriptPath } = getBulletproofBridgeConfig();

  const pythonProbe = spawnSync(pythonBin, ["--version"], { encoding: "utf-8" });
  if (pythonProbe.error || pythonProbe.status !== 0) {
    checks.push({ name: "engine_python", status: "unhealthy", detail: pythonProbe.error?.message ?? pythonProbe.stderr?.trim() ?? "python_not_available" });
    checks.push({ name: "engine_bridge", status: "degraded", detail: "python_unavailable" });
    checks.push({ name: "engine_probe", status: "degraded", detail: "python_unavailable" });
    return checks;
  }

  checks.push({ name: "engine_python", status: "healthy", detail: (pythonProbe.stdout || pythonProbe.stderr).trim() });

  const bridgeExists = fs.existsSync(bridgeScriptPath);
  checks.push({
    name: "engine_bridge",
    status: bridgeExists ? "healthy" : "unhealthy",
    detail: bridgeExists ? bridgeScriptPath : `missing_bridge_script:${bridgeScriptPath}`,
  });

  if (!bridgeExists) {
    checks.push({ name: "engine_probe", status: "degraded", detail: "bridge_missing" });
    return checks;
  }

  try {
    const probe = await probeBulletproofEngine();
    checks.push({ name: "engine_probe", status: probe.ok ? "healthy" : "unhealthy", detail: probe.engine_version ? `version=${probe.engine_version}` : "version_unavailable" });
    checks.push({ name: "engine_seam", status: probe.ok ? "healthy" : "unhealthy", detail: "run_analysis_from_parsed_artifact available" });
  } catch (error) {
    checks.push({ name: "engine_probe", status: "unhealthy", detail: error instanceof Error ? error.message : "engine_probe_error" });
    checks.push({ name: "engine_seam", status: "unhealthy", detail: "engine_not_available" });
  }

  return checks;
}

function getQueueCheck(): StartupCheck {
  const row = getDb().prepare(`SELECT
      (SELECT COUNT(*) FROM analysis_jobs WHERE status IN ('queued','processing')) as analysis_backlog,
      (SELECT COUNT(*) FROM export_jobs WHERE status IN ('queued','processing')) as export_backlog`).get() as { analysis_backlog: number; export_backlog: number };

  const totalBacklog = Number(row.analysis_backlog) + Number(row.export_backlog);
  if (totalBacklog > 50) {
    return { name: "queue", status: "degraded", detail: "queue_backlog_high", meta: { analysis_backlog: row.analysis_backlog, export_backlog: row.export_backlog } };
  }

  return { name: "queue", status: "healthy", detail: "db_backed_queue", meta: { analysis_backlog: row.analysis_backlog, export_backlog: row.export_backlog } };
}

function getWorkerCheck(workerType: "analysis" | "export"): StartupCheck {
  const staleMs = getWorkerHeartbeatStaleMs();
  const heartbeats = workerHeartbeatRepository.list(workerType);
  if (heartbeats.length === 0) {
    return { name: `${workerType}_worker`, status: "degraded", detail: "no_worker_heartbeat" };
  }

  const freshest = heartbeats[0];
  const isStale = Date.now() - Date.parse(freshest.last_seen_at) > staleMs;
  return {
    name: `${workerType}_worker`,
    status: isStale ? "degraded" : "healthy",
    detail: isStale ? "worker_heartbeat_stale" : "worker_heartbeat_fresh",
    meta: {
      worker_id: freshest.worker_id,
      last_seen_at: freshest.last_seen_at,
      status: freshest.status,
      active_instances: heartbeats.length,
    },
  };
}

export async function assertStartupReady() {
  const checks = await runStartupValidation();
  const failures = checks.filter((c) => c.status === "unhealthy");
  if (failures.length > 0) {
    const summary = failures.map((f) => `${f.name}:${f.detail ?? "failed"}`).join(", ");
    throw new Error(`startup_validation_failed:${summary}`);
  }
  return checks;
}
