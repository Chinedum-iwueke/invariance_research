import { randomUUID } from "node:crypto";
import type {
  AnalysisDetailResponse,
  AnalysisListItem,
  AnalysisStatusResponse,
  CreateAnalysisRequest,
  CreateAnalysisResponse,
} from "@/lib/contracts";
import { assertUsageWithinPlan } from "@/lib/server/entitlements/usage";
import { enqueueAnalysisRetry } from "@/lib/server/queue/analysis-queue";
import { analysisRepository } from "@/lib/server/repositories/analysis-repository";
import { artifactRepository } from "@/lib/server/repositories/artifact-repository";
import { jobRepository } from "@/lib/server/repositories/job-repository";
import { scheduleAnalysisJob } from "@/lib/server/services/analysis-job-runner";
import { buildPersistedBenchmarkConfig, parseBenchmarkSelectionFromRequest } from "@/lib/analyses/create-analysis";

export async function createAnalysisFromArtifact(
  payload: CreateAnalysisRequest & { owner_user_id: string; account_id: string },
): Promise<CreateAnalysisResponse> {
  const artifact = artifactRepository.findById(payload.artifact_id);
  if (!artifact || !artifact.eligibility_summary.accepted) {
    throw new Error("artifact_not_eligible");
  }

  if (artifact.account_id !== payload.account_id) {
    throw new Error("artifact_access_denied");
  }

  assertUsageWithinPlan(payload.account_id);

  const timestamp = new Date().toISOString();
  const analysisId = randomUUID();
  const jobId = randomUUID();
  const benchmarkSelection = parseBenchmarkSelectionFromRequest(payload);
  const benchmark = await buildPersistedBenchmarkConfig({
    selection: benchmarkSelection,
    parsedArtifact: artifact.parsed_artifact,
  });

  analysisRepository.save({
    analysis_id: analysisId,
    owner_user_id: payload.owner_user_id,
    account_id: payload.account_id,
    status: "queued",
    strategy_name: payload.strategy_name,
    artifact_id: artifact.artifact_id,
    created_at: timestamp,
    updated_at: timestamp,
    eligibility_snapshot: artifact.eligibility_summary,
    benchmark,
    runtime_config: payload.runtime_config,
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
    available_at: timestamp,
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

export function getOwnedAnalysis(analysisId: string, accountId: string) {
  const analysis = analysisRepository.findById(analysisId);
  if (!analysis || analysis.account_id !== accountId) return undefined;
  return analysis;
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
    analysis_id: analysis.analysis_id,
    status: analysis.status,
    record: analysis.result,
    error:
      analysis.status === "failed"
        ? { code: analysis.failure_code ?? "analysis_failed", message: analysis.failure_message ?? "Analysis failed." }
        : undefined,
  };
}

export function listAnalyses(accountId?: string): AnalysisListItem[] {
  return analysisRepository
    .list()
    .filter((analysis) => (accountId ? analysis.account_id === accountId : true))
    .map((analysis) => {
      const artifact = artifactRepository.findById(analysis.artifact_id);
      const result = analysis.result;
      return {
        analysis_id: analysis.analysis_id,
        strategy_name:
          analysis.strategy_name?.trim() ||
          result?.strategy.strategy_name ??
          artifact?.parsed_artifact.strategy_metadata?.strategy_name ??
          "Untitled upload",
        trade_count: result?.dataset.trade_count ?? artifact?.parsed_artifact.trades.length ?? 0,
        timeframe: result?.strategy.timeframe ?? artifact?.parsed_artifact.trades[0]?.timeframe ?? "N/A",
        asset: resolveAssetLabel({
          datasetMarket: result?.dataset.market,
          parsedTrades: artifact?.parsed_artifact.trades,
        }),
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

  const retryCount = job.retry_count + 1;
  enqueueAnalysisRetry(analysisId, retryCount);

  return getAnalysisStatus(analysisId);
}

function resolveAssetLabel(input: { datasetMarket?: string; parsedTrades?: Array<{ symbol?: string }> }) {
  if (input.datasetMarket?.trim()) {
    return input.datasetMarket.trim();
  }

  const symbols = new Set(
    (input.parsedTrades ?? [])
      .map((trade) => trade.symbol?.trim())
      .filter((symbol): symbol is string => Boolean(symbol)),
  );

  if (symbols.size === 1) {
    return Array.from(symbols)[0];
  }
  if (symbols.size > 1) {
    return "Multi-Asset";
  }

  return "N/A";
}
