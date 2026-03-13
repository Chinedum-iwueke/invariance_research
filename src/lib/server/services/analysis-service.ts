import { randomUUID } from "node:crypto";
import type {
  AnalysisDetailResponse,
  AnalysisListItem,
  AnalysisStatusResponse,
  CreateAnalysisRequest,
  CreateAnalysisResponse,
} from "@/lib/contracts";
import { analysisRepository } from "@/lib/server/repositories/analysis-repository";
import { artifactRepository } from "@/lib/server/repositories/artifact-repository";
import { jobRepository } from "@/lib/server/repositories/job-repository";
import { scheduleAnalysisJob } from "@/lib/server/services/analysis-job-runner";

export function createAnalysisFromArtifact(payload: CreateAnalysisRequest): CreateAnalysisResponse {
  const artifact = artifactRepository.findById(payload.artifact_id);
  if (!artifact || !artifact.eligibility_summary.accepted) {
    throw new Error("artifact_not_eligible");
  }

  const timestamp = new Date().toISOString();
  const analysisId = randomUUID();
  const jobId = randomUUID();

  analysisRepository.save({
    analysis_id: analysisId,
    owner_id: "demo-owner",
    status: "queued",
    strategy_name: payload.strategy_name,
    artifact_id: artifact.artifact_id,
    created_at: timestamp,
    updated_at: timestamp,
  });

  artifactRepository.attachAnalysis(artifact.artifact_id, analysisId);

  jobRepository.save({
    job_id: jobId,
    analysis_id: analysisId,
    job_type: "analysis_v1",
    status: "queued",
    progress_pct: 0,
    current_step: "Queued",
    created_at: timestamp,
    retry_count: 0,
  });

  scheduleAnalysisJob(analysisId);

  return {
    analysis_id: analysisId,
    status: "queued",
    job: { job_id: jobId, status: "queued" },
    artifact_summary: {
      detected_artifact_type: artifact.eligibility_summary.detected_artifact_type,
      detected_richness: artifact.eligibility_summary.detected_richness,
    },
    next_urls: {
      status: `/api/analyses/${analysisId}/status`,
      overview: `/app/analyses/${analysisId}/overview`,
    },
  };
}

export function getAnalysisStatus(analysisId: string): AnalysisStatusResponse | undefined {
  const analysis = analysisRepository.findById(analysisId);
  const job = jobRepository.findByAnalysisId(analysisId);

  if (!analysis || !job) return undefined;

  return {
    analysis_id: analysisId,
    status: analysis.status,
    job_status: job.status,
    current_step: job.current_step,
    progress_pct: job.progress_pct,
    message:
      analysis.status === "failed"
        ? "Analysis processing failed."
        : analysis.status === "completed"
          ? "Analysis completed."
          : "Analysis is processing.",
    error:
      analysis.status === "failed"
        ? { code: analysis.failure_code ?? "analysis_failed", message: analysis.failure_message ?? "Analysis failed." }
        : undefined,
  };
}

export function getAnalysisDetail(analysisId: string): AnalysisDetailResponse | undefined {
  const analysis = analysisRepository.findById(analysisId);
  if (!analysis) return undefined;
  return {
    analysis_id: analysisId,
    status: analysis.status,
    record: analysis.result,
    error:
      analysis.status === "failed"
        ? { code: analysis.failure_code ?? "analysis_failed", message: analysis.failure_message ?? "Analysis failed." }
        : undefined,
  };
}

export function listAnalyses(): AnalysisListItem[] {
  return analysisRepository.list().map((analysis) => {
    const artifact = artifactRepository.findById(analysis.artifact_id);
    const result = analysis.result;
    return {
      analysis_id: analysis.analysis_id,
      strategy_name:
        result?.strategy.strategy_name ??
        analysis.strategy_name ??
        artifact?.parsed_artifact.strategy_metadata?.strategy_name ??
        "Untitled upload",
      trade_count: result?.dataset.trade_count ?? artifact?.parsed_artifact.trades.length ?? 0,
      timeframe: result?.strategy.timeframe ?? artifact?.parsed_artifact.trades[0]?.timeframe ?? "N/A",
      asset: result?.dataset.market ?? artifact?.parsed_artifact.trades[0]?.market ?? "N/A",
      created_at: analysis.created_at.slice(0, 10),
      status: analysis.status,
      robustness_score: result?.summary.robustness_score?.value ?? "Pending",
    };
  });
}

export function retryAnalysis(analysisId: string): AnalysisStatusResponse | undefined {
  const analysis = analysisRepository.findById(analysisId);
  const job = jobRepository.findByAnalysisId(analysisId);
  if (!analysis || !job || analysis.status !== "failed") return undefined;

  analysisRepository.update(analysisId, (current) => ({
    ...current,
    status: "queued",
    updated_at: new Date().toISOString(),
    failure_code: undefined,
    failure_message: undefined,
  }));

  jobRepository.updateByAnalysisId(analysisId, (current) => ({
    ...current,
    status: "queued",
    current_step: "Queued for retry",
    progress_pct: 0,
    error_code: undefined,
    error_message: undefined,
    retry_count: current.retry_count + 1,
    finished_at: undefined,
  }));

  scheduleAnalysisJob(analysisId);
  return getAnalysisStatus(analysisId);
}
