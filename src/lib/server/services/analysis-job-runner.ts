import { enqueueAnalysisRun } from "@/lib/server/queue/analysis-queue";

export async function scheduleAnalysisJob(analysisId: string): Promise<void> {
  await enqueueAnalysisRun(analysisId);
}
