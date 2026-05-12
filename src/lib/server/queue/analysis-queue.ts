import { logger } from "@/lib/server/ops/logger";
import { getAnalysisQueue } from "@/lib/server/queue/provider";
import { shouldRunEmbeddedWorkers } from "@/lib/server/queue/runtime-config";
import { startAnalysisWorker } from "@/lib/server/workers/analysis-worker";

export async function enqueueAnalysisRun(analysisId: string) {
  await getAnalysisQueue().enqueue({ analysisId });
  logger.info("analysis.queue.enqueued", { analysis_id: analysisId });
  if (shouldRunEmbeddedWorkers()) startAnalysisWorker();
}

export async function enqueueAnalysisRetry(analysisId: string, retryCount: number) {
  const job = await getAnalysisQueue().retry({ analysisId, retryCount });
  logger.info("analysis.queue.retry_enqueued", { analysis_id: analysisId, retry_count: retryCount, available_at: job?.available_at });
  if (shouldRunEmbeddedWorkers()) startAnalysisWorker();
}
