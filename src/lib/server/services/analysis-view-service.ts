import { notFound } from "next/navigation";
import type { AnalysisRecord } from "@/lib/contracts";
import type { AnalysisEntity } from "@/lib/server/analysis/models";
import { analysisRepository } from "@/lib/server/repositories/analysis-repository";

export function requireOwnedAnalysisView(analysisId: string, accountId: string): { analysis: AnalysisEntity; record?: AnalysisRecord } {
  const analysis = analysisRepository.findById(analysisId);
  if (!analysis || analysis.account_id !== accountId) {
    notFound();
  }

  return {
    analysis,
    record: analysis.result,
  };
}
