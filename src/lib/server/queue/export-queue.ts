import { exportJobRepository } from "@/lib/server/repositories/export-job-repository";
import { shouldRunEmbeddedWorkers } from "@/lib/server/queue/runtime-config";
import { startExportWorker } from "@/lib/server/workers/export-worker";

const BASE_BACKOFF_MS = 2_000;

export const exportQueue = {
  enqueueRun(exportId: string) {
    exportJobRepository.updateByExportId(exportId, (current) => ({ ...current, status: "queued", available_at: new Date().toISOString() }));
    if (shouldRunEmbeddedWorkers()) startExportWorker();
  },
  enqueueRetry(exportId: string, retryCount: number) {
    const availableAt = new Date(Date.now() + BASE_BACKOFF_MS * Math.max(1, retryCount)).toISOString();
    exportJobRepository.updateByExportId(exportId, (current) => ({
      ...current,
      status: "queued",
      available_at: availableAt,
      retry_count: retryCount,
      current_step: "Queued for retry",
      progress_pct: 0,
      finished_at: undefined,
    }));
    if (shouldRunEmbeddedWorkers()) startExportWorker();
  },
};
