import { randomUUID } from "node:crypto";
import { getDatabaseProvider } from "@/lib/server/persistence/provider";
import { getPostgresPool } from "@/lib/server/persistence/postgres";
import { logger } from "@/lib/server/ops/logger";
import { getObjectStorage, getObjectStorageProvider } from "@/lib/server/storage/object-storage";
import { assertWorkerRuntimeConfig } from "@/lib/server/queue/runtime-config";
import { createWorkerInstanceId, runWorkerLoop } from "@/lib/server/workers/worker-runtime";
import { researchProgramRepository } from "@/lib/server/research-programs/repository";
import { executeExperimentJob, uploadExperimentFailureCards } from "@/lib/server/research-programs/experiment-executor";
import { ingestExperimentEventIntoMemory } from "@/lib/server/research-memory/service";
import type { ExperimentJobEventRecord, ExperimentJobRecord } from "@/lib/server/research-programs/models";

function positiveIntegerEnv(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function eventFor(job: ExperimentJobRecord, event_type: ExperimentJobEventRecord["event_type"], message: string, payload: Record<string, unknown> = {}): ExperimentJobEventRecord {
  return {
    experiment_job_event_id: randomUUID(),
    experiment_job_id: job.experiment_job_id,
    experiment_plan_id: job.experiment_plan_id,
    program_id: job.program_id,
    account_id: job.account_id,
    event_type,
    message,
    payload,
    created_at: new Date().toISOString(),
  };
}

function summarizeArtifacts(artifacts: Awaited<ReturnType<typeof executeExperimentJob>>["artifacts"]) {
  return artifacts.map((artifact) => ({
    storage_key: artifact.storage_key,
    content_type: artifact.content_type,
    size_bytes: artifact.size_bytes,
    checksum_sha256: artifact.checksum_sha256,
  }));
}

async function recordAndIngestVerdictMemory(event: ExperimentJobEventRecord) {
  await researchProgramRepository.recordEvent({
    event_id: randomUUID(),
    program_id: event.program_id,
    account_id: event.account_id,
    event_type: "verdict_recorded",
    title: event.event_type === "failed" ? "Execution failure cards recorded" : "Verdict cards recorded",
    summary: event.event_type === "failed"
      ? "B7 recorded a failure verdict packet for the experiment job."
      : "B7 recorded the experiment verdict card bundle.",
    payload: event.payload,
    created_at: new Date().toISOString(),
  });
  await ingestExperimentEventIntoMemory(event);
}

export async function runExperimentWorkerRuntime() {
  const config = assertWorkerRuntimeConfig();
  if (config.mode !== "external") {
    throw new Error("Experiment worker runtime requires WORKER_MODE=external.");
  }
  const workerInstanceId = process.env.INVARIANCE_EXPERIMENT_WORKER_INSTANCE_ID || createWorkerInstanceId();
  const concurrency = positiveIntegerEnv("INVARIANCE_EXPERIMENT_WORKER_CONCURRENCY", 1);
  const maxActive = positiveIntegerEnv("INVARIANCE_EXPERIMENT_WORKER_MAX_ACTIVE", concurrency);
  logger.info("experiment.worker.startup", {
    database_provider: getDatabaseProvider(),
    object_storage_provider: getObjectStorageProvider(),
    worker_instance_id: workerInstanceId,
    concurrency,
    max_active: maxActive,
  });
  await validateExperimentWorkerDependencies(workerInstanceId);
  await runWorkerLoop({ workerType: "experiment", processNext: processNextExperimentJob, instanceId: workerInstanceId, concurrency, maxActive });
}

async function validateExperimentWorkerDependencies(workerInstanceId: string) {
  if (getDatabaseProvider() !== "postgres") {
    throw new Error(`experiment_worker_requires_postgres:${getDatabaseProvider()}`);
  }
  await getPostgresPool().query("SELECT 1");
  const storage = getObjectStorage();
  if (["r2", "s3"].includes(getObjectStorageProvider())) {
    await storage.listObjects?.("");
  } else {
    await storage.objectExists("healthcheck");
  }
  logger.info("experiment.worker.health", { status: "healthy", worker_instance_id: workerInstanceId });
}

export async function processNextExperimentJob(): Promise<boolean> {
  const now = new Date().toISOString();
  const leaseMs = positiveIntegerEnv("INVARIANCE_EXPERIMENT_JOB_TIMEOUT_MS", 30 * 60 * 1000);
  const job = await researchProgramRepository.claimNextExperimentJob({ now, leaseMs });
  if (!job) return false;
  logger.info("experiment.worker.claimed", { experiment_job_id: job.experiment_job_id, program_id: job.program_id });
  await researchProgramRepository.updateExperimentJob({
    job_id: job.experiment_job_id,
    account_id: job.account_id,
    patch: { status: "processing", progress_pct: 15, current_step: "Loading approved experiment contract", leased_until: job.leased_until },
    event: eventFor(job, "claimed", "Experiment job claimed by B6 worker.", { lease_ms: leaseMs }),
  });

  try {
    const [plan, item] = await Promise.all([
      researchProgramRepository.findExperimentPlan(job.experiment_plan_id),
      researchProgramRepository.findExperimentPlanItem(job.experiment_plan_item_id),
    ]);
    if (!plan) throw new Error("experiment_plan_missing");
    if (!item) throw new Error("experiment_plan_item_missing");
    const strategy = await researchProgramRepository.findStrategySpec(plan.strategy_spec_record_id);
    if (!strategy) throw new Error("strategy_spec_missing");

    await researchProgramRepository.updateExperimentJob({
      job_id: job.experiment_job_id,
      account_id: job.account_id,
      patch: { progress_pct: 35, current_step: "Executing bt experiment contract" },
      event: eventFor(job, "worker_note", "Approved strategy, plan, and item loaded.", {
        strategy_spec_record_id: strategy.strategy_spec_record_id,
        experiment_plan_id: plan.experiment_plan_id,
        item_key: item.item_key,
      }),
    });

    const result = await executeExperimentJob({ job, plan, item, strategy });
    const artifactPayload = summarizeArtifacts(result.artifacts);
    const completedEvent = eventFor(job, "completed", "Experiment contract execution completed and artifacts were stored.", {
      artifact_count: result.artifacts.length,
      artifacts: artifactPayload,
      engine_manifest: result.engine_payload["manifest"],
      card_summary: result.card_summary,
    });
    await researchProgramRepository.updateExperimentJob({
      job_id: job.experiment_job_id,
      account_id: job.account_id,
      patch: {
        status: "completed",
        progress_pct: 100,
        current_step: "Completed",
        finished_at: new Date().toISOString(),
        leased_until: undefined,
        last_error: undefined,
      },
      event: completedEvent,
    });
    await researchProgramRepository.recordEvent({
      event_id: randomUUID(),
      program_id: job.program_id,
      account_id: job.account_id,
      event_type: "run_completed",
      title: "Experiment completed",
      summary: "The B6 worker materialized the approved experiment contract and stored its artifacts.",
      payload: {
        experiment_job_id: job.experiment_job_id,
        experiment_plan_id: job.experiment_plan_id,
        artifact_count: result.artifacts.length,
      },
      created_at: new Date().toISOString(),
    });
    await recordAndIngestVerdictMemory(completedEvent);
    logger.info("experiment.worker.completed", { experiment_job_id: job.experiment_job_id, artifact_count: result.artifacts.length });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "experiment_execution_failed";
    const attempts = job.retry_count + 1;
    const terminal = attempts >= job.max_attempts;
    const failureCards = terminal
      ? await uploadExperimentFailureCards({ job, error: message }).catch((cardError) => {
          logger.error("experiment.worker.failure_cards_failed", {
            experiment_job_id: job.experiment_job_id,
            message: cardError instanceof Error ? cardError.message : "failure_card_upload_failed",
          });
          return undefined;
        })
      : undefined;
    const failureEvent = eventFor(job, terminal ? "failed" : "retried", terminal ? "Experiment execution failed." : "Experiment execution failed and was queued for retry.", {
      error: message.slice(0, 2000),
      retry_count: attempts,
      max_attempts: job.max_attempts,
      artifact_count: failureCards?.artifacts.length ?? 0,
      artifacts: failureCards ? summarizeArtifacts(failureCards.artifacts) : [],
      card_summary: failureCards?.card_summary,
    });
    await researchProgramRepository.updateExperimentJob({
      job_id: job.experiment_job_id,
      account_id: job.account_id,
      patch: {
        status: terminal ? "failed" : "queued",
        retry_count: attempts,
        progress_pct: terminal ? 100 : 0,
        current_step: terminal ? "Failed" : "Queued for retry",
        available_at: new Date(Date.now() + Math.min(60_000 * attempts, 5 * 60_000)).toISOString(),
        leased_until: undefined,
        last_error: message.slice(0, 2000),
        finished_at: terminal ? new Date().toISOString() : undefined,
      },
      event: failureEvent,
    });
    if (terminal) {
      await recordAndIngestVerdictMemory(failureEvent);
    }
    logger.error("experiment.worker.failed", { experiment_job_id: job.experiment_job_id, terminal, message });
    return true;
  }
}
