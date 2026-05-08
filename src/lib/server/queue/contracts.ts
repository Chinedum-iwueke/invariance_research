import type { AnalysisJob } from "@/lib/server/analysis/models";

export type QueueProvider = "db" | "upstash";
export type QueueJobStatus = AnalysisJob["status"];

export type QueueJobMetadata = {
  job_id: string;
  job_type: AnalysisJob["job_type"];
  analysis_id: string;
  account_id?: string;
  status: QueueJobStatus;
  attempts: number;
  max_attempts: number;
  leased_until?: string;
  last_error?: string;
  created_at: string;
  updated_at: string;
};

export interface AnalysisQueue {
  enqueue(input: { analysisId: string; availableAt?: string }): AnalysisJob | undefined;
  lease(input?: { nowIso?: string; leaseMs?: number; workerId?: string }): AnalysisJob | undefined | Promise<AnalysisJob | undefined>;
  ack(input: { analysisId: string; resultStep?: string }): AnalysisJob | undefined;
  complete(input: { analysisId: string }): AnalysisJob | undefined;
  retry(input: { analysisId: string; retryCount?: number; availableAt?: string; lastError?: string }): AnalysisJob | undefined;
  deadLetter(input: { analysisId: string; errorCode?: string; errorMessage?: string }): AnalysisJob | undefined;
  heartbeat(input: { analysisId: string; leaseMs?: number; nowIso?: string }): AnalysisJob | undefined;
  extendLease(input: { analysisId: string; leaseMs?: number; nowIso?: string }): AnalysisJob | undefined;
  getJobStatus(jobId: string): QueueJobMetadata | undefined;
  listFailed(limit?: number): QueueJobMetadata[];
  listDeadLetters(limit?: number): QueueJobMetadata[];
}

export function toQueueJobMetadata(job: AnalysisJob): QueueJobMetadata {
  return {
    job_id: job.job_id,
    job_type: job.job_type,
    analysis_id: job.analysis_id,
    account_id: job.account_id,
    status: job.status,
    attempts: job.attempts ?? job.retry_count,
    max_attempts: job.max_attempts ?? 3,
    leased_until: job.leased_until,
    last_error: job.last_error ?? job.error_message,
    created_at: job.created_at,
    updated_at: job.updated_at ?? job.finished_at ?? job.started_at ?? job.created_at,
  };
}
