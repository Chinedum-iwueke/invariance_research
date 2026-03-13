import { analysisRepository } from "@/lib/server/repositories/analysis-repository";
import { artifactRepository } from "@/lib/server/repositories/artifact-repository";
import { jobRepository } from "@/lib/server/repositories/job-repository";
import { runBulletproofAnalysisFromParsedArtifact } from "@/lib/server/engine/bulletproof-runner";
import { normalizeEngineResultToAnalysisRecord } from "@/lib/server/services/analysis-normalizer";

const STEP_DELAY_MS = 150;
const RUNNING_ANALYSES = new Set<string>();

const STEPS = {
  validating: { step: "Validating canonical artifact", progress: 12 },
  loading: { step: "Loading persisted eligibility profile", progress: 25 },
  engine: { step: "Running bulletproof_bt engine seam", progress: 70 },
  normalizing: { step: "Normalizing AnalysisRecord output", progress: 90 },
} as const;

export function scheduleAnalysisJob(analysisId: string): void {
  if (RUNNING_ANALYSES.has(analysisId)) return;
  RUNNING_ANALYSES.add(analysisId);

  void runAnalysisJob(analysisId).finally(() => {
    RUNNING_ANALYSES.delete(analysisId);
  });
}

async function runAnalysisJob(analysisId: string): Promise<void> {
  const analysis = analysisRepository.findById(analysisId);
  if (!analysis) return;

  const artifact = artifactRepository.findById(analysis.artifact_id);
  if (!artifact) return markFailed(analysisId, "artifact_missing", "Artifact reference not found.");

  const eligibility = analysis.eligibility_snapshot ?? artifact.eligibility_summary;
  if (!eligibility.accepted) {
    return markFailed(analysisId, "eligibility_conflict", "Artifact is not eligible for analysis.");
  }

  analysisRepository.update(analysisId, (current) => ({ ...current, status: "processing", updated_at: new Date().toISOString() }));
  jobRepository.updateByAnalysisId(analysisId, (current) => ({
    ...current,
    status: "processing",
    started_at: new Date().toISOString(),
    current_step: "Starting analysis",
    progress_pct: 5,
  }));

  try {
    await moveToStep(analysisId, STEPS.validating);
    await moveToStep(analysisId, STEPS.loading);

    await moveToStep(analysisId, STEPS.engine);
    const engineRun = await runBulletproofAnalysisFromParsedArtifact({
      parsedArtifact: artifact.parsed_artifact,
      eligibility,
    });

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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analysis execution failed.";
    const code = mapErrorCode(message);
    markFailed(analysisId, code, normalizeErrorMessage(code));
  }
}

async function moveToStep(analysisId: string, next: { step: string; progress: number }) {
  jobRepository.updateByAnalysisId(analysisId, (current) => ({ ...current, current_step: next.step, progress_pct: next.progress }));
  await delay(STEP_DELAY_MS);
}

function mapErrorCode(message: string): string {
  if (message.includes("engine_entrypoint_missing") || message.includes("bulletproof_bt")) return "engine_execution_failed";
  if (message.includes("parse")) return "artifact_parse_failed";
  if (message.includes("eligibility")) return "eligibility_conflict";
  if (message.includes("persist")) return "persistence_failed";
  if (message.includes("ZodError")) return "normalization_failed";
  return "engine_execution_failed";
}

function normalizeErrorMessage(code: string): string {
  const map: Record<string, string> = {
    artifact_parse_failed: "Artifact parsing failed before engine execution.",
    eligibility_conflict: "Upload eligibility conflicts with requested diagnostics.",
    engine_execution_failed: "Engine execution failed. You can retry this analysis.",
    normalization_failed: "Engine output could not be normalized safely.",
    persistence_failed: "Analysis completed but persistence failed.",
  };

  return map[code] ?? "Analysis execution failed.";
}

function markFailed(analysisId: string, code: string, message: string) {
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
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
