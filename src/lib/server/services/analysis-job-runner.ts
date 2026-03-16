import { enqueueAnalysisRun } from "@/lib/server/queue/analysis-queue";

export function scheduleAnalysisJob(analysisId: string): void {
  enqueueAnalysisRun(analysisId);
}
