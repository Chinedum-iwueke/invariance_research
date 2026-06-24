import fs from "node:fs";
import { spawnSync } from "node:child_process";

import { getDatabaseProvider } from "@/lib/server/persistence/provider";
import { getPostgresPool } from "@/lib/server/persistence/postgres";
import { getSqliteRuntimeDb } from "@/lib/server/persistence/sqlite-runtime";
import { getObjectStorage } from "@/lib/server/storage/object-storage";
import { getBulletproofBridgeConfig, probeBulletproofEngine } from "@/lib/server/engine/bulletproof-client";
import { logger } from "@/lib/server/ops/logger";
import { assertWorkerRuntimeConfig, getWorkerHeartbeatStaleMs } from "@/lib/server/queue/runtime-config";
import { workerHeartbeatRepository } from "@/lib/server/repositories/worker-heartbeat-repository";
import { getOperationControls, pausedOperationNames } from "@/lib/server/ops/operations-policy";

export type HealthLevel = "healthy" | "degraded" | "unhealthy";
export type StartupCheck = { name: string; status: HealthLevel; detail?: string; meta?: Record<string, unknown> };

export async function runStartupValidation(): Promise<StartupCheck[]> {
  const checks: StartupCheck[] = [];

  checks.push(await getDatabaseCheck());
  checks.push(getPostgresPoolConfigCheck());
  checks.push(getOperationControlsCheck());

  try {
    const test = await getObjectStorage().putObject({ bucket: "reports", file_name: "healthcheck.txt", content_type: "text/plain", bytes: new Uint8Array(Buffer.from("ok")), storage_key: "reports/healthcheck.txt" });
    await getObjectStorage().deleteObject(test.storage_key);
    checks.push({ name: "storage", status: "healthy" });
  } catch (error) {
    checks.push({ name: "storage", status: "unhealthy", detail: error instanceof Error ? error.message : "storage_error" });
  }
  checks.push(getObjectStorageLifecycleCheck());

  checks.push(getStripeConfigCheck());
  checks.push(getEmailConfigCheck());

  try {
    const workerConfig = assertWorkerRuntimeConfig();
    checks.push({ name: "worker_runtime", status: "healthy", detail: `${workerConfig.mode}:${workerConfig.nodeEnv}` });
  } catch (error) {
    checks.push({ name: "worker_runtime", status: "unhealthy", detail: error instanceof Error ? error.message : "worker_runtime_invalid" });
  }

  checks.push(...(await getEngineChecks()));

  checks.push(await getQueueCheck());
  checks.push(await getWorkerCheck("analysis"));
  checks.push(await getWorkerCheck("export"));
  checks.push(await getWorkerCheck("experiment"));
  checks.push(await getWorkerCheck("execution"));

  logger.info("startup.validation.completed", { checks });
  return checks;
}

async function getDatabaseCheck(): Promise<StartupCheck> {
  try {
    const provider = getDatabaseProvider();
    if (provider === "postgres") {
      await getPostgresPool().query("SELECT 1");
      return { name: "database", status: "healthy", detail: "postgres" };
    }

    getSqliteRuntimeDb().prepare("SELECT 1").get();
    return { name: "database", status: "healthy", detail: "sqlite" };
  } catch (error) {
    return { name: "database", status: "unhealthy", detail: error instanceof Error ? error.message : "db_error" };
  }
}

function getEmailConfigCheck(): StartupCheck {
  const provider = (process.env.EMAIL_PROVIDER ?? "").trim().toLowerCase();
  const hasResend = Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

  if (provider === "resend") {
    return {
      name: "email_config",
      status: hasResend ? "healthy" : "degraded",
      detail: hasResend ? "resend_configured" : "EMAIL_PROVIDER=resend requires RESEND_API_KEY and EMAIL_FROM",
    };
  }

  if (process.env.NODE_ENV === "production") {
    return { name: "email_config", status: "degraded", detail: "production email provider not configured" };
  }

  return { name: "email_config", status: "degraded", detail: "email disabled for local development" };
}

function getObjectStorageLifecycleCheck(): StartupCheck {
  const configured = (process.env.OBJECT_STORAGE_LIFECYCLE_CONFIGURED ?? "false").trim().toLowerCase() === "true";
  return {
    name: "storage_lifecycle",
    status: configured ? "healthy" : "degraded",
    detail: configured ? "lifecycle_policy_confirmed" : "set OBJECT_STORAGE_LIFECYCLE_CONFIGURED=true after bucket lifecycle rules are configured",
  };
}

function getStripeConfigCheck(): StartupCheck {
  const missing = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_EXPLORER", "STRIPE_PRICE_PRO"].filter((key) => !process.env[key]);
  if (missing.length === 0) {
    return { name: "stripe_config", status: "healthy" };
  }

  return {
    name: "stripe_config",
    status: process.env.NODE_ENV === "production" ? "unhealthy" : "degraded",
    detail: `Missing ${missing.join(", ")}`,
  };
}

function getPostgresPoolConfigCheck(): StartupCheck {
  if (getDatabaseProvider() !== "postgres") {
    return { name: "postgres_pool", status: "degraded", detail: "not_postgres" };
  }

  const url = process.env.DATABASE_URL ?? "";
  const poolMax = Number.parseInt(process.env.POSTGRES_POOL_MAX ?? (process.env.VERCEL || process.env.NODE_ENV === "production" ? "1" : "5"), 10);
  const hasSslMode = /[?&]sslmode=(require|verify-full|verify-ca)/i.test(url);
  const hasCompat = /[?&]uselibpqcompat=true/i.test(url);
  const issues: string[] = [];

  if (process.env.NODE_ENV === "production" && !hasSslMode) issues.push("missing_sslmode");
  if (process.env.NODE_ENV === "production" && /sslmode=require/i.test(url) && !hasCompat) issues.push("missing_uselibpqcompat_for_sslmode_require");
  if (process.env.VERCEL && poolMax > 1) issues.push("vercel_pool_max_above_1");

  return {
    name: "postgres_pool",
    status: issues.length ? "degraded" : "healthy",
    detail: issues.length ? issues.join(",") : `pool_max=${poolMax}`,
    meta: {
      pool_max: Number.isFinite(poolMax) ? poolMax : undefined,
      sslmode_configured: hasSslMode,
      uselibpqcompat: hasCompat,
    },
  };
}

function getOperationControlsCheck(): StartupCheck {
  const controls = getOperationControls();
  const paused = pausedOperationNames(controls);
  return {
    name: "operation_controls",
    status: paused.length ? "degraded" : "healthy",
    detail: paused.length ? `paused:${paused.join(",")}` : "accepting_work",
    meta: controls,
  };
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

async function getQueueCheck(): Promise<StartupCheck> {
  try {
    const provider = getDatabaseProvider();
    const row =
      provider === "postgres"
        ? (
            await getPostgresPool().query<{ analysis_backlog: number | string; export_backlog: number | string; experiment_backlog: number | string; execution_backlog: number | string }>(`SELECT
      (SELECT COUNT(*)::int FROM analysis_jobs WHERE status IN ('queued','processing')) as analysis_backlog,
      (SELECT COUNT(*)::int FROM export_jobs WHERE status IN ('queued','processing')) as export_backlog,
      (SELECT COUNT(*)::int FROM experiment_jobs WHERE status IN ('queued','processing')) as experiment_backlog,
      (SELECT COUNT(*)::int FROM deployment_commands WHERE status IN ('queued','processing')) as execution_backlog`)
          ).rows[0]
        : (getSqliteRuntimeDb().prepare(`SELECT
      (SELECT COUNT(*) FROM analysis_jobs WHERE status IN ('queued','processing')) as analysis_backlog,
      (SELECT COUNT(*) FROM export_jobs WHERE status IN ('queued','processing')) as export_backlog,
      (SELECT COUNT(*) FROM experiment_jobs WHERE status IN ('queued','processing')) as experiment_backlog,
      (SELECT COUNT(*) FROM deployment_commands WHERE status IN ('queued','processing')) as execution_backlog`).get() as { analysis_backlog: number; export_backlog: number; experiment_backlog: number; execution_backlog: number });

    const analysisBacklog = Number(row?.analysis_backlog ?? 0);
    const exportBacklog = Number(row?.export_backlog ?? 0);
    const experimentBacklog = Number(row?.experiment_backlog ?? 0);
    const executionBacklog = Number(row?.execution_backlog ?? 0);
    const totalBacklog = analysisBacklog + exportBacklog + experimentBacklog + executionBacklog;
    if (totalBacklog > 50) {
      return { name: "queue", status: "degraded", detail: "queue_backlog_high", meta: { provider, analysis_backlog: analysisBacklog, export_backlog: exportBacklog, experiment_backlog: experimentBacklog, execution_backlog: executionBacklog } };
    }

    return { name: "queue", status: "healthy", detail: "db_backed_queue", meta: { provider, analysis_backlog: analysisBacklog, export_backlog: exportBacklog, experiment_backlog: experimentBacklog, execution_backlog: executionBacklog } };
  } catch (error) {
    return { name: "queue", status: "unhealthy", detail: error instanceof Error ? error.message : "queue_check_error" };
  }
}

async function getWorkerCheck(workerType: "analysis" | "export" | "experiment" | "execution"): Promise<StartupCheck> {
  const staleMs = getWorkerHeartbeatStaleMs();
  const heartbeats = await workerHeartbeatRepository.list(workerType);
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
      worker_id: freshest.instance_id,
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
