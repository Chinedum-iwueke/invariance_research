import { getCoreRepositories } from "@/lib/server/persistence/repositories";
import type { AnalysisQueue } from "@/lib/server/queue/contracts";
import { toQueueJobMetadata } from "@/lib/server/queue/contracts";

const BASE_BACKOFF_MS = 2_000;

export const dbAnalysisQueue: AnalysisQueue = {
  enqueue(input) {
    return getCoreRepositories().analysisJobs.updateByAnalysisId(input.analysisId, (current) => ({
      ...current,
      status: "queued",
      available_at: input.availableAt ?? new Date().toISOString(),
      leased_until: undefined,
      error_code: undefined,
      error_message: undefined,
      last_error: undefined,
      updated_at: new Date().toISOString(),
    }));
  },
  lease(input = {}) {
    return getCoreRepositories().analysisJobs.claimNextQueued(input.nowIso ?? new Date().toISOString(), {
      leaseMs: input.leaseMs,
      workerId: input.workerId,
    });
  },
  ack(input) {
    return getCoreRepositories().analysisJobs.updateByAnalysisId(input.analysisId, (current) => ({
      ...current,
      current_step: input.resultStep ?? current.current_step,
      leased_until: undefined,
      updated_at: new Date().toISOString(),
    }));
  },
  complete(input) {
    const now = new Date().toISOString();
    return getCoreRepositories().analysisJobs.updateByAnalysisId(input.analysisId, (current) => ({
      ...current,
      status: "completed",
      progress_pct: 100,
      current_step: "Completed",
      finished_at: now,
      leased_until: undefined,
      error_code: undefined,
      error_message: undefined,
      last_error: undefined,
      updated_at: now,
    }));
  },
  async retry(input) {
    const current = await getCoreRepositories().analysisJobs.findByAnalysisId(input.analysisId);
    if (!current) return undefined;
    const retryCount = input.retryCount ?? current.retry_count + 1;
    const maxAttempts = current.max_attempts ?? 3;
    if (retryCount >= maxAttempts) {
      return this.deadLetter({
        analysisId: input.analysisId,
        errorCode: current.error_code,
        errorMessage: input.lastError ?? current.error_message ?? current.last_error,
      });
    }
    const availableAt = input.availableAt ?? new Date(Date.now() + BASE_BACKOFF_MS * Math.max(1, retryCount)).toISOString();
    return getCoreRepositories().analysisJobs.updateByAnalysisId(input.analysisId, (job) => ({
      ...job,
      status: "queued",
      retry_count: retryCount,
      available_at: availableAt,
      leased_until: undefined,
      current_step: "Queued for retry",
      progress_pct: 0,
      finished_at: undefined,
      last_error: input.lastError ?? job.error_message ?? job.last_error,
      updated_at: new Date().toISOString(),
    }));
  },
  deadLetter(input) {
    const now = new Date().toISOString();
    return getCoreRepositories().analysisJobs.updateByAnalysisId(input.analysisId, (current) => ({
      ...current,
      status: "dead_letter",
      current_step: "Dead-lettered",
      finished_at: now,
      leased_until: undefined,
      error_code: input.errorCode ?? current.error_code,
      error_message: input.errorMessage ?? current.error_message,
      last_error: input.errorMessage ?? current.last_error ?? current.error_message,
      retry_count: current.max_attempts ?? current.retry_count,
      updated_at: now,
    }));
  },
  heartbeat(input) {
    return this.extendLease(input);
  },
  extendLease(input) {
    const now = input.nowIso ?? new Date().toISOString();
    const leasedUntil = new Date(Date.parse(now) + (input.leaseMs ?? 5 * 60 * 1000)).toISOString();
    return getCoreRepositories().analysisJobs.updateByAnalysisId(input.analysisId, (current) => ({
      ...current,
      leased_until: leasedUntil,
      updated_at: now,
    }));
  },
  getJobStatus(jobId) {
    const job = getCoreRepositories().analysisJobs.findById(jobId);
    if (job instanceof Promise) return job.then((value) => (value ? toQueueJobMetadata(value) : undefined));
    return job ? toQueueJobMetadata(job) : undefined;
  },
  async listFailed(limit) {
    return (await getCoreRepositories().analysisJobs.listFailed(limit)).map(toQueueJobMetadata);
  },
  async listDeadLetters(limit) {
    return (await getCoreRepositories().analysisJobs.listDeadLetters(limit)).map(toQueueJobMetadata);
  },
};
