import { logger } from "@/lib/server/ops/logger";
import { jobRepository } from "@/lib/server/repositories/job-repository";
import { shouldRunEmbeddedWorkers } from "@/lib/server/queue/runtime-config";
import { startAnalysisWorker } from "@/lib/server/workers/analysis-worker";

const BASE_BACKOFF_MS = 2_000;

export function enqueueAnalysisRun(analysisId: string) {
  jobRepository.updateByAnalysisId(analysisId, (current) => ({
    ...current,
    status: "queued",
    available_at: new Date().toISOString(),
    error_code: undefined,
    error_message: undefined,
  }));
  logger.info("analysis.queue.enqueued", { analysis_id: analysisId });
  if (shouldRunEmbeddedWorkers()) startAnalysisWorker();
}

export function enqueueAnalysisRetry(analysisId: string, retryCount: number) {
  const delay = BASE_BACKOFF_MS * Math.max(1, retryCount);
  const availableAt = new Date(Date.now() + delay).toISOString();
  jobRepository.updateByAnalysisId(analysisId, (current) => ({
    ...current,
    status: "queued",
    available_at: availableAt,
    current_step: "Queued for retry",
    progress_pct: 0,
    retry_count: retryCount,
    finished_at: undefined,
  }));
  logger.info("analysis.queue.retry_enqueued", { analysis_id: analysisId, retry_count: retryCount, available_at: availableAt });
  if (shouldRunEmbeddedWorkers()) startAnalysisWorker();
}
