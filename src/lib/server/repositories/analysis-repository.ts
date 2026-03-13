import type { AnalysisEntity } from "@/lib/server/analysis/models";

const analyses = new Map<string, AnalysisEntity>();

export const analysisRepository = {
  save(analysis: AnalysisEntity): AnalysisEntity {
    analyses.set(analysis.analysis_id, analysis);
    return analysis;
  },
  update(analysisId: string, updater: (current: AnalysisEntity) => AnalysisEntity): AnalysisEntity | undefined {
    const current = analyses.get(analysisId);
    if (!current) return undefined;
    const next = updater(current);
    analyses.set(analysisId, next);
    return next;
  },
  findById(analysisId: string): AnalysisEntity | undefined {
    return analyses.get(analysisId);
  },
  list(): AnalysisEntity[] {
    return Array.from(analyses.values()).sort((a, b) => b.created_at.localeCompare(a.created_at));
  },
};
