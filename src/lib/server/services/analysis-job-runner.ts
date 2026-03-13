import { analysisRepository } from "@/lib/server/repositories/analysis-repository";
import { artifactRepository } from "@/lib/server/repositories/artifact-repository";
import { jobRepository } from "@/lib/server/repositories/job-repository";
import { normalizeAnalysisRecord } from "@/lib/server/services/analysis-normalizer";

const STEP_DELAY_MS = 350;
const RUNNING_ANALYSES = new Set<string>();

const STEPS = [
  { step: "Validating canonical artifact", progress: 15 },
  { step: "Preparing diagnostic context", progress: 35 },
  { step: "Running transitional analysis adapter", progress: 65 },
  { step: "Normalizing AnalysisRecord output", progress: 90 },
] as const;

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
  if (!artifact) {
    markFailed(analysisId, "artifact_missing", "Artifact reference not found.");
    return;
  }

  analysisRepository.update(analysisId, (current) => ({ ...current, status: "processing", updated_at: new Date().toISOString() }));
  jobRepository.updateByAnalysisId(analysisId, (current) => ({ ...current, status: "processing", started_at: new Date().toISOString(), current_step: "Starting analysis", progress_pct: 5 }));

  for (const item of STEPS) {
    jobRepository.updateByAnalysisId(analysisId, (current) => ({ ...current, current_step: item.step, progress_pct: item.progress }));
    await delay(STEP_DELAY_MS);
  }

  try {
    const record = normalizeAnalysisRecord({
      analysisId,
      parsedArtifact: artifact.parsed_artifact,
      eligibility: artifact.eligibility_summary,
    });

    analysisRepository.update(analysisId, (current) => ({
      ...current,
      status: "completed",
      result: record,
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
  } catch {
    markFailed(analysisId, "analysis_normalization_failed", "Analysis normalization failed.");
  }
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
