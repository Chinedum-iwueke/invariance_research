import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { AnalysisRunState } from "@/components/dashboard/analysis-run-state";
import { EvidenceList } from "@/components/dashboard/evidence-list";
import { ResearchDeskRequestPanel } from "@/components/dashboard/research-desk-request-panel";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { requireServerSession } from "@/lib/server/auth/session";
import { requireOwnedAnalysisView } from "@/lib/server/services/analysis-view-service";

const STABILITY_REVIEW_SCOPES = [
  "True parameter stability requires a coherent multi-run sweep, run-to-parameter mapping, and comparable outputs across each run.",
  "A single params.json file documents settings but does not prove stability or a robust parameter surface.",
  "Research Desk can design or review the sweep, identify fragile regions, and attach a reviewer-approved stability addendum.",
];

export default async function StabilityPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const { id } = await params;
  const { analysis, record } = await requireOwnedAnalysisView(id, session.account_id);

  if (!record) {
    return (
      <AnalysisPageFrame title="Parameter Stability Review" description="Parameter stability is routed to Research Desk for launch.">
        <AnalysisRunState analysis={analysis} />
      </AnalysisPageFrame>
    );
  }

  return (
    <AnalysisPageFrame title="Parameter Stability Review" description="Automated parameter-surface claims are deferred to Research Desk until a real sweep can support them.">
      <WorkspaceCard title="Why this is not an automated launch workspace" subtitle="Stability claims need more than a single parameter file or one backtest path.">
        <EvidenceList items={STABILITY_REVIEW_SCOPES} empty="No stability review scope emitted." tone="warning" />
      </WorkspaceCard>
      <ResearchDeskRequestPanel
        analysisId={record.analysis_id}
        limitations={STABILITY_REVIEW_SCOPES}
        defaultServices={["parameter_stability_review", "claim_validation", "investor_buyer_memo_review"]}
        evidenceInsufficiencyScopes={STABILITY_REVIEW_SCOPES}
      />
    </AnalysisPageFrame>
  );
}
