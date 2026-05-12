import { notFound } from "next/navigation";
import type { AnalysisRecord } from "@/lib/contracts";
import type { AnalysisEntity } from "@/lib/server/analysis/models";
import { getCoreRepositories } from "@/lib/server/persistence/repositories";

export async function requireOwnedAnalysisView(analysisId: string, accountId: string): Promise<{ analysis: AnalysisEntity; record?: AnalysisRecord }> {
  const analysis = await getCoreRepositories().analyses.findById(analysisId);
  if (!analysis || analysis.account_id !== accountId) {
    notFound();
  }

  return {
    analysis,
    record: analysis.result,
  };
}
