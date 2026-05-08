import type { AnalysisQueue, QueueProvider } from "@/lib/server/queue/contracts";
import { dbAnalysisQueue } from "@/lib/server/queue/db-analysis-queue";
import { createUpstashAnalysisQueue } from "@/lib/server/queue/upstash-analysis-queue";

let queue: AnalysisQueue | undefined;

export function getQueueProvider(): QueueProvider {
  const provider = process.env.ANALYSIS_QUEUE_PROVIDER ?? "db";
  if (provider !== "db" && provider !== "upstash") {
    throw new Error(`Unsupported ANALYSIS_QUEUE_PROVIDER "${provider}". Expected db or upstash.`);
  }
  return provider;
}

export function getAnalysisQueue(): AnalysisQueue {
  if (queue) return queue;
  queue = getQueueProvider() === "upstash" ? createUpstashAnalysisQueue() : dbAnalysisQueue;
  return queue;
}

export function resetAnalysisQueueForTests() {
  queue = undefined;
}
