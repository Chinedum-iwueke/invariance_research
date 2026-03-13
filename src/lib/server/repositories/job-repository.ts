import type { AnalysisJob } from "@/lib/server/analysis/models";

const jobs = new Map<string, AnalysisJob>();

export const jobRepository = {
  save(job: AnalysisJob): AnalysisJob {
    jobs.set(job.analysis_id, job);
    return job;
  },
  findByAnalysisId(analysisId: string): AnalysisJob | undefined {
    return jobs.get(analysisId);
  },
  updateByAnalysisId(analysisId: string, updater: (current: AnalysisJob) => AnalysisJob): AnalysisJob | undefined {
    const current = jobs.get(analysisId);
    if (!current) return undefined;
    const next = updater(current);
    jobs.set(analysisId, next);
    return next;
  },
};
