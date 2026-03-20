import { analysisRepository } from "@/lib/server/repositories/analysis-repository";
import { artifactRepository } from "@/lib/server/repositories/artifact-repository";
import { jobRepository } from "@/lib/server/repositories/job-repository";
import { runBulletproofAnalysisFromParsedArtifact } from "@/lib/server/engine/bulletproof-runner";
import { normalizeEngineResultToAnalysisRecord } from "@/lib/server/services/analysis-normalizer";
import { logger } from "@/lib/server/ops/logger";
import { runWorkerLoop } from "@/lib/server/workers/worker-runtime";

const STEP_DELAY_MS = 50;
let loopActive = false;

const STEPS = {
  validating: { step: "Validating canonical artifact", progress: 12 },
  loading: { step: "Loading persisted eligibility profile", progress: 25 },
  engine: { step: "Running bt engine seam", progress: 70 },
  normalizing: { step: "Normalizing AnalysisRecord output", progress: 90 },
} as const;

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
  await runWorkerLoop({ workerType: "analysis", processNext: processNextAnalysisJob });
}

export async function processNextAnalysisJob(): Promise<boolean> {
  const claimed = jobRepository.claimNextQueued(new Date().toISOString());
  if (claimed) logger.info("analysis.worker.claimed", { analysis_id: claimed.analysis_id, job_id: claimed.job_id });
  if (!claimed) return false;
  const analysisId = claimed.analysis_id;
  const analysis = analysisRepository.findById(analysisId);
  if (!analysis) return false;

  const artifact = artifactRepository.findById(analysis.artifact_id);
  if (!artifact) return markFailed(analysisId, "artifact_missing", "Artifact reference not found.");

  const eligibility = analysis.eligibility_snapshot ?? artifact.eligibility_summary;
  if (!eligibility.accepted) {
    return markFailed(analysisId, "eligibility_conflict", "Artifact is not eligible for analysis.");
  }

  analysisRepository.update(analysisId, (current) => ({ ...current, status: "processing", updated_at: new Date().toISOString() }));

  try {
    await moveToStep(analysisId, STEPS.validating);
    await moveToStep(analysisId, STEPS.loading);

    await moveToStep(analysisId, STEPS.engine);
    const engineRun = await runBulletproofAnalysisFromParsedArtifact({ parsedArtifact: artifact.parsed_artifact, eligibility });

    if (engineRun.result.status === "failed") {
      return markFailed(analysisId, "engine_execution_failed", "The analysis engine reported a failed run.");
    }

    await moveToStep(analysisId, STEPS.normalizing);
    const record = normalizeEngineResultToAnalysisRecord({
      analysisId,
      parsedArtifact: artifact.parsed_artifact,
      eligibility,
      engineResult: engineRun.result,
      engineContext: engineRun.context,
    });

    analysisRepository.update(analysisId, (current) => ({
      ...current,
      status: "completed",
      result: record,
      engine_context: engineRun.context,
      updated_at: new Date().toISOString(),
      failure_code: undefined,
      failure_message: undefined,
    }));

    jobRepository.updateByAnalysisId(analysisId, (current) => ({
      ...current,
      status: "completed",
      progress_pct: 100,
      current_step: "Completed",
      finished_at: new Date().toISOString(),
      error_code: undefined,
      error_message: undefined,
    }));
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
  jobRepository.updateByAnalysisId(analysisId, (current) => ({ ...current, current_step: next.step, progress_pct: next.progress }));
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

function markFailed(analysisId: string, code: string, message: string): boolean {
  analysisRepository.update(analysisId, (current) => ({
    ...current,
    status: "failed",
    updated_at: new Date().toISOString(),
    failure_code: code,
    failure_message: message,
  }));

  jobRepository.updateByAnalysisId(analysisId, (current) => ({
    ...current,
    status: "failed",
    current_step: "Failed",
    finished_at: new Date().toISOString(),
    error_code: code,
    error_message: message,
  }));
  return true;
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
