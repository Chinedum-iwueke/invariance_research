import fs from "node:fs";
import path from "node:path";
import { getCoreRepositories } from "@/lib/server/persistence/repositories";
import { getAnalysisQueue, getQueueProvider } from "@/lib/server/queue/provider";
import { runBulletproofAnalysisFromParsedArtifact } from "@/lib/server/engine/bulletproof-runner";
import { normalizeEngineResultToAnalysisRecord } from "@/lib/server/services/analysis-normalizer";
import { logger } from "@/lib/server/ops/logger";
import { runWorkerLoop } from "@/lib/server/workers/worker-runtime";
import { accountService } from "@/lib/server/accounts/service";
import { readArtifact } from "@/lib/server/storage/artifact-storage";
import { getObjectStorageProvider } from "@/lib/server/storage/object-storage";
import { assertWorkerRuntimeConfig } from "@/lib/server/queue/runtime-config";
import { generateLlmInsightsForRecord, mergeLlmInsightResult } from "@/lib/server/llm-insights";

const STEP_DELAY_MS = 50;
let loopActive = false;

const STEPS = {
  validating: { step: "Validating canonical artifact", progress: 12 },
  loading: { step: "Loading persisted eligibility profile", progress: 25 },
  engine: { step: "Running bt engine seam", progress: 70 },
  normalizing: { step: "Normalizing AnalysisRecord output", progress: 90 },
  llm: { step: "Generating diagnostic synthesis", progress: 96 },
} as const;


function writeDebugSnapshot(name: string, analysisId: string, payload: unknown) {
  const dir = path.join(process.cwd(), ".debug-analysis");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, `${analysisId}__${name}.json`),
    JSON.stringify(payload, null, 2),
    "utf8",
  );
}

export function startAnalysisWorker() {
  if (loopActive) return;
  loopActive = true;
  queueMicrotask(async () => {
    try {
      while (await processNextAnalysisJob()) {
        // drain queue
      }
    } finally {
      loopActive = false;
    }
  });
}

export async function runAnalysisWorkerRuntime() {
  const config = assertWorkerRuntimeConfig();
  if (config.mode !== "external") {
    throw new Error("Analysis worker runtime requires WORKER_MODE=external.");
  }
  logger.info("analysis.worker.startup", {
    database_provider: getCoreRepositories().provider,
    queue_provider: getQueueProvider(),
    storage_provider: getObjectStorageProvider(),
  });
  await runWorkerLoop({ workerType: "analysis", processNext: processNextAnalysisJob });
}

export async function processNextAnalysisJob(): Promise<boolean> {
  const claimed = await getAnalysisQueue().lease({ nowIso: new Date().toISOString() });
  if (claimed) logger.info("analysis.worker.claimed", { analysis_id: claimed.analysis_id, job_id: claimed.job_id });
  if (!claimed) return false;
  const repositories = getCoreRepositories();
  const analysisId = claimed.analysis_id;
  const analysis = await repositories.analyses.findById(analysisId);
  if (!analysis) return false;

  const artifact = await repositories.artifacts.findById(analysis.artifact_id);
  if (!artifact) return markFailed(analysisId, "artifact_missing", "Artifact reference not found.");
  try {
    await readArtifact(artifact.storage_key);
  } catch {
    return markFailed(analysisId, "artifact_missing", "Stored artifact bytes could not be loaded.");
  }

  const eligibility = analysis.eligibility_snapshot ?? artifact.eligibility_summary;
  if (!eligibility.accepted) {
    return markFailed(analysisId, "eligibility_conflict", "Artifact is not eligible for analysis.");
  }

  await repositories.analyses.update(analysisId, (current) => ({ ...current, status: "processing", updated_at: new Date().toISOString() }));

  try {
    await moveToStep(analysisId, STEPS.validating);
    await moveToStep(analysisId, STEPS.loading);

    await moveToStep(analysisId, STEPS.engine);
    const engineRun = await runBulletproofAnalysisFromParsedArtifact({ analysis, parsedArtifact: artifact.parsed_artifact, eligibility });

    if (engineRun.result.status === "failed") {
      return markFailed(analysisId, "engine_execution_failed", "The analysis engine reported a failed run.");
    }

    writeDebugSnapshot("01_engine_raw_result", analysisId, engineRun.result);

    await moveToStep(analysisId, STEPS.normalizing);
    const deterministicRecord = normalizeEngineResultToAnalysisRecord({
      analysisId,
      parsedArtifact: artifact.parsed_artifact,
      eligibility,
      engineResult: engineRun.result,
      engineContext: engineRun.context,
    });
    await moveToStep(analysisId, STEPS.llm);
    const llmStartedAt = Date.now();
    logger.info("llm.insights.started", {
      analysis_id: analysisId,
      provider: process.env.LLM_PROVIDER?.trim().toLowerCase() || "ollama",
      model: process.env.OLLAMA_MODEL?.trim() || "llama3.1:8b",
    });
    const llmResult = await generateLlmInsightsForRecord(deterministicRecord, analysis.benchmark);
    const llmLogFields = {
      analysis_id: analysisId,
      model: llmResult.model ?? process.env.OLLAMA_MODEL?.trim() ?? "llama3.1:8b",
      status: llmResult.status,
      duration_ms: llmResult.duration_ms ?? Date.now() - llmStartedAt,
      prompt_tokens: llmResult.prompt_tokens,
      completion_tokens: llmResult.completion_tokens,
      timeout_reason: llmResult.timeout_reason,
      error: llmResult.error,
    };
    if (llmResult.status === "generated") {
      logger.info("llm.insights.completed", llmLogFields);
    } else if (llmResult.status === "disabled") {
      logger.info("llm.fallback.used", { ...llmLogFields, reason: "disabled" });
    } else {
      logger.warn("llm.insights.failed", llmLogFields);
      logger.warn("llm.fallback.used", llmLogFields);
    }
    const record = mergeLlmInsightResult(deterministicRecord, llmResult);

    writeDebugSnapshot("02_normalized_record_pre_persist", analysisId, record);

    await repositories.analyses.update(analysisId, (current) => ({
      ...current,
      status: "completed",
      result: record,
      engine_context: engineRun.context,
      updated_at: new Date().toISOString(),
      failure_code: undefined,
      failure_message: undefined,
    }));
    await accountService.incrementUsage(analysis.account_id, "analysis");

    await getAnalysisQueue().complete({ analysisId });
    logger.info("analysis.worker.completed", { analysis_id: analysisId });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analysis execution failed.";
    const code = mapErrorCode(message);
    logger.error("analysis.worker.failed", { analysis_id: analysisId, code, message });
    return markFailed(analysisId, code, normalizeErrorMessage(code));
  }
}

async function moveToStep(analysisId: string, next: { step: string; progress: number }) {
  await getCoreRepositories().analysisJobs.updateByAnalysisId(analysisId, (current) => ({ ...current, current_step: next.step, progress_pct: next.progress }));
  await delay(STEP_DELAY_MS);
}

function mapErrorCode(message: string): string {
  if (message.includes("engine_input_validation_failed")) return "engine_input_validation_failed";
  if (message.includes("engine_contract_mismatch")) return "engine_contract_mismatch";
  if (
    message.includes("engine_execution_failed")
    || message.includes("engine_process_failed")
    || message.includes("engine_entrypoint_missing")
    || message.includes("run_analysis_from_parsed_artifact")
    || message.includes("positional argument")
    || message.includes("bt")
    || message.includes("bulletproof_bt")
  ) return "engine_execution_failed";
  if (message.includes("parse")) return "artifact_parse_failed";
  if (message.includes("eligibility")) return "eligibility_conflict";
  if (message.includes("persist")) return "persistence_failed";
  if (message.includes("ZodError")) return "normalization_failed";
  return "engine_execution_failed";
}

function normalizeErrorMessage(code: string): string {
  const map: Record<string, string> = {
    artifact_parse_failed: "Artifact parsing failed before engine execution.",
    engine_input_validation_failed: "Engine rejected the analysis payload because it did not match the expected input schema.",
    engine_contract_mismatch: "Engine bridge contract mismatch detected. Verify bridge/runtime compatibility.",
    eligibility_conflict: "Upload eligibility conflicts with requested diagnostics.",
    engine_execution_failed: "Engine execution failed. You can retry this analysis.",
    normalization_failed: "Engine output could not be normalized safely.",
    persistence_failed: "Analysis completed but persistence failed.",
  };

  return map[code] ?? "Analysis execution failed.";
}

async function markFailed(analysisId: string, code: string, message: string): Promise<boolean> {
  const repositories = getCoreRepositories();
  await repositories.analyses.update(analysisId, (current) => ({
    ...current,
    status: "failed",
    updated_at: new Date().toISOString(),
    failure_code: code,
    failure_message: message,
  }));

  await repositories.analysisJobs.updateByAnalysisId(analysisId, (current) => {
    const retryCount = current.retry_count + 1;
    const maxAttempts = current.max_attempts ?? 3;
    if (retryCount >= maxAttempts) {
      return {
        ...current,
        status: "dead_letter",
        current_step: "Dead-lettered",
        finished_at: new Date().toISOString(),
        leased_until: undefined,
        retry_count: retryCount,
        error_code: code,
        error_message: message,
        last_error: message,
        updated_at: new Date().toISOString(),
      };
    }
    return {
      ...current,
      status: "failed",
      current_step: "Failed",
      finished_at: new Date().toISOString(),
      leased_until: undefined,
      retry_count: retryCount,
      error_code: code,
      error_message: message,
      last_error: message,
      updated_at: new Date().toISOString(),
    };
  });
  return true;
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
