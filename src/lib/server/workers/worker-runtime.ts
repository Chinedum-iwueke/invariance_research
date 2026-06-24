import { hostname } from "node:os";
import { randomUUID } from "node:crypto";
import { logger } from "@/lib/server/ops/logger";
import { getWorkerPollIntervalMs } from "@/lib/server/queue/runtime-config";
import { workerHeartbeatRepository } from "@/lib/server/repositories/worker-heartbeat-repository";

type WorkerType = "analysis" | "export" | "experiment" | "execution";

type WorkerRunInput = {
  workerType: WorkerType;
  processNext: () => Promise<boolean>;
  instanceId?: string;
  concurrency?: number;
  maxActive?: number;
};

const DEFAULT_DEPENDENCY_BACKOFF_MS = 5 * 60 * 1000;
const DEFAULT_RUNTIME_ERROR_BACKOFF_MS = 60 * 1000;

export function createWorkerInstanceId() {
  return `${hostname()}-${process.pid}-${randomUUID().slice(0, 8)}`;
}

function positiveIntegerEnv(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? "worker_runtime_error");
}

export function isDatabaseAuthOrCircuitBreakerError(error: unknown) {
  const message = errorMessage(error).toLowerCase();
  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code ?? "").toUpperCase()
    : "";
  return code === "XX000"
    || message.includes("ecircuitbreaker")
    || message.includes("too many authentication failures")
    || message.includes("password authentication failed")
    || message.includes("self-signed certificate in certificate chain");
}

export function workerErrorBackoffMs(error: unknown) {
  if (isDatabaseAuthOrCircuitBreakerError(error)) {
    return positiveIntegerEnv("INVARIANCE_WORKER_DB_ERROR_BACKOFF_MS", DEFAULT_DEPENDENCY_BACKOFF_MS);
  }
  return positiveIntegerEnv("INVARIANCE_WORKER_RUNTIME_ERROR_BACKOFF_MS", DEFAULT_RUNTIME_ERROR_BACKOFF_MS);
}

export async function waitForWorkerDependencies(input: {
  workerType: WorkerType;
  instanceId: string;
  validate: () => Promise<void>;
}) {
  while (true) {
    try {
      await input.validate();
      return;
    } catch (error) {
      const message = errorMessage(error);
      const backoffMs = workerErrorBackoffMs(error);
      logger.error("worker.dependencies.unavailable", {
        worker_type: input.workerType,
        instance_id: input.instanceId,
        message,
        backoff_ms: backoffMs,
      });
      await sleep(backoffMs);
    }
  }
}

export async function runWorkerLoop(input: WorkerRunInput) {
  const instanceId = input.instanceId ?? createWorkerInstanceId();
  const pollMs = getWorkerPollIntervalMs(input.workerType);
  const concurrency = Math.max(1, Math.floor(input.concurrency ?? 1));
  const maxActive = Math.max(1, Math.floor(input.maxActive ?? concurrency));
  const active = new Set<Promise<boolean>>();
  let stopping = false;
  const stop = (signal: string) => {
    stopping = true;
    logger.info("worker.runtime.stopping", { worker_type: input.workerType, instance_id: instanceId, signal });
  };
  process.once("SIGTERM", () => stop("SIGTERM"));
  process.once("SIGINT", () => stop("SIGINT"));
  logger.info("worker.runtime.started", { worker_type: input.workerType, instance_id: instanceId, poll_ms: pollMs });
  logger.info("worker.concurrency.started", { worker_type: input.workerType, instance_id: instanceId, concurrency, max_active: maxActive });

  const startSlot = () => {
    const task = (async () => {
      try {
        const didWork = await input.processNext();
        const now = new Date().toISOString();
        await workerHeartbeatRepository.upsert({
          worker_type: input.workerType,
          instance_id: instanceId,
          status: didWork ? "processing" : "idle",
          last_seen_at: now,
          updated_at: now,
        });
        return didWork;
      } catch (error) {
        const message = errorMessage(error);
        const backoffMs = workerErrorBackoffMs(error);
        logger.error("worker.runtime.loop_failed", { worker_type: input.workerType, instance_id: instanceId, message, backoff_ms: backoffMs });
        await sleep(backoffMs);
        return true;
      }
    })().finally(() => {
      active.delete(task);
      logger.info("job.active_count", { worker_type: input.workerType, instance_id: instanceId, active_count: active.size });
    });
    active.add(task);
    logger.info("job.active_count", { worker_type: input.workerType, instance_id: instanceId, active_count: active.size });
  };

  while (!stopping) {
    try {
      while (!stopping && active.size < concurrency && active.size < maxActive) {
        startSlot();
      }
      if (active.size > 0) {
        const didWork = await Promise.race(active);
        if (!didWork && active.size === 0) {
          await sleep(pollMs);
        }
      } else {
        await sleep(pollMs);
      }
    } catch (error) {
      const message = errorMessage(error);
      const backoffMs = Math.max(workerErrorBackoffMs(error), pollMs);
      logger.error("worker.runtime.loop_failed", { worker_type: input.workerType, instance_id: instanceId, message, backoff_ms: backoffMs });
      await sleep(backoffMs);
    }
  }

  if (active.size > 0) {
    logger.info("worker.runtime.draining", { worker_type: input.workerType, instance_id: instanceId, active_count: active.size });
    await Promise.allSettled(active);
  }

  await workerHeartbeatRepository.upsert({
    worker_type: input.workerType,
    instance_id: instanceId,
    status: "idle",
    last_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  logger.info("worker.runtime.stopped", { worker_type: input.workerType, instance_id: instanceId });
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
