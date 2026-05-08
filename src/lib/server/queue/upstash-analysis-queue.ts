import type { AnalysisQueue } from "@/lib/server/queue/contracts";

export function createUpstashAnalysisQueue(): AnalysisQueue {
  const unavailable = () => {
    throw new Error("Upstash Redis analysis queue is reserved for a later phase. Use ANALYSIS_QUEUE_PROVIDER=db for now.");
  };
  return {
    enqueue: unavailable,
    lease: unavailable,
    ack: unavailable,
    complete: unavailable,
    retry: unavailable,
    deadLetter: unavailable,
    heartbeat: unavailable,
    extendLease: unavailable,
    getJobStatus: unavailable,
    listFailed: unavailable,
    listDeadLetters: unavailable,
  };
}
