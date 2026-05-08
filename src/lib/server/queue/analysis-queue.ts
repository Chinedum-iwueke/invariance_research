import { logger } from "@/lib/server/ops/logger";
import { getAnalysisQueue } from "@/lib/server/queue/provider";
import { shouldRunEmbeddedWorkers } from "@/lib/server/queue/runtime-config";
import { startAnalysisWorker } from "@/lib/server/workers/analysis-worker";

export function enqueueAnalysisRun(analysisId: string) {
  getAnalysisQueue().enqueue({ analysisId });
  logger.info("analysis.queue.enqueued", { analysis_id: analysisId });
  if (shouldRunEmbeddedWorkers()) startAnalysisWorker();
}

export function enqueueAnalysisRetry(analysisId: string, retryCount: number) {
  const job = getAnalysisQueue().retry({ analysisId, retryCount });
  logger.info("analysis.queue.retry_enqueued", { analysis_id: analysisId, retry_count: retryCount, available_at: job?.available_at });
  if (shouldRunEmbeddedWorkers()) startAnalysisWorker();
}
