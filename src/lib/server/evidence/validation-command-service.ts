import { buildValidationCommandLayer } from "@/lib/app/validation-command-layer";
import { evidenceEventRepository } from "@/lib/server/evidence/evidence-events";
import { exportRepository } from "@/lib/server/repositories/export-repository";
import { reportSnapshotRepository } from "@/lib/server/repositories/report-snapshot-repository";
import { shareAccessEventRepository, shareTokenRepository } from "@/lib/server/repositories/share-token-repository";
import { getCoreRepositories } from "@/lib/server/persistence/repositories";

export async function getValidationCommandLayer(input: { analysis_id: string; account_id: string }) {
  const analysis = await getCoreRepositories().analyses.findById(input.analysis_id);
  if (!analysis || analysis.account_id !== input.account_id) throw new Error("analysis_not_found");
  return buildValidationCommandLayer({
    analysis,
    record: analysis.result,
    activeSnapshot: reportSnapshotRepository.findActiveByAnalysis(analysis.analysis_id),
    snapshots: reportSnapshotRepository.listByAnalysis(analysis.analysis_id),
    exports: exportRepository.listByAnalysis(analysis.analysis_id),
    shares: shareTokenRepository.listByAnalysis(analysis.analysis_id),
    shareEvents: shareAccessEventRepository.listByAnalysis(analysis.analysis_id),
    evidenceEvents: evidenceEventRepository.listByAnalysis(analysis.analysis_id),
  });
}

