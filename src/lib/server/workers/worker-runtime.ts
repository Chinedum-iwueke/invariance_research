import { hostname } from "node:os";
import { randomUUID } from "node:crypto";
import { logger } from "@/lib/server/ops/logger";
import { getWorkerPollIntervalMs } from "@/lib/server/queue/runtime-config";
import { workerHeartbeatRepository } from "@/lib/server/repositories/worker-heartbeat-repository";

type WorkerType = "analysis" | "export";

type WorkerRunInput = {
  workerType: WorkerType;
  processNext: () => Promise<boolean>;
};

export async function runWorkerLoop(input: WorkerRunInput) {
  const instanceId = `${hostname()}-${process.pid}-${randomUUID().slice(0, 8)}`;
  const pollMs = getWorkerPollIntervalMs(input.workerType);
  let stopping = false;
  const stop = (signal: string) => {
    stopping = true;
    logger.info("worker.runtime.stopping", { worker_type: input.workerType, instance_id: instanceId, signal });
  };
  process.once("SIGTERM", () => stop("SIGTERM"));
  process.once("SIGINT", () => stop("SIGINT"));
  logger.info("worker.runtime.started", { worker_type: input.workerType, instance_id: instanceId, poll_ms: pollMs });

  while (!stopping) {
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
      if (!didWork) {
        await sleep(pollMs);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "worker_runtime_error";
      logger.error("worker.runtime.loop_failed", { worker_type: input.workerType, instance_id: instanceId, message });
      await sleep(Math.max(1000, pollMs));
    }
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
