import type { AnalysisRecord } from "@/lib/contracts";
import { mapEngineAnalysisResultToAnalysisRecord } from "@/lib/server/adapters/bulletproof";
import type { EngineAnalysisResult, EngineRunContext } from "@/lib/server/engine/engine-types";
import type { ParsedArtifact, UploadEligibilitySummary } from "@/lib/server/ingestion";

export function normalizeEngineResultToAnalysisRecord(params: {
  analysisId: string;
  parsedArtifact: ParsedArtifact;
  eligibility: UploadEligibilitySummary;
  engineResult: EngineAnalysisResult;
  engineContext: EngineRunContext;
}): AnalysisRecord {
  return mapEngineAnalysisResultToAnalysisRecord({
    analysisId: params.analysisId,
    parsedArtifact: params.parsedArtifact,
    eligibility: params.eligibility,
    engine: params.engineResult,
    engineContext: params.engineContext,
  });
}
