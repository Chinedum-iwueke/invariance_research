import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { AnalysisRunState } from "@/components/dashboard/analysis-run-state";
import { EvidenceList } from "@/components/dashboard/evidence-list";
import { ResearchDeskRequestPanel } from "@/components/dashboard/research-desk-request-panel";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { requireServerSession } from "@/lib/server/auth/session";
import { requireOwnedAnalysisView } from "@/lib/server/services/analysis-view-service";

const REGIME_REVIEW_SCOPES = [
  "Multi-asset regime attribution requires explicit symbol coverage, timestamp alignment, and regime definitions.",
  "Uploaded OHLCV can improve context, but automated upload review should not claim portfolio-level attribution without reviewer validation.",
  "Research Desk can define regime buckets, verify data alignment, and attach a reviewer-approved regime addendum.",
];

export default async function RegimesPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const { id } = await params;
  const { analysis, record } = await requireOwnedAnalysisView(id, session.account_id);

  if (!record) {
    return (
      <AnalysisPageFrame title="Regime Review" description="Market-state attribution is routed to Research Desk when self-serve evidence is insufficient.">
        <AnalysisRunState analysis={analysis} />
      </AnalysisPageFrame>
    );
  }

  return (
    <AnalysisPageFrame title="Regime Review" description="Automated regime attribution is deferred to Research Desk until the evidence can support it cleanly.">
      <WorkspaceCard title="Why this is not an automated workspace" subtitle="Regime attribution is easy to overstate when market context is incomplete or misaligned.">
        <EvidenceList items={REGIME_REVIEW_SCOPES} empty="No regime review scope emitted." tone="warning" />
      </WorkspaceCard>
      <ResearchDeskRequestPanel
        analysisId={record.analysis_id}
        limitations={REGIME_REVIEW_SCOPES}
        defaultServices={["regime_context_review", "data_quality_audit", "claim_validation"]}
        evidenceInsufficiencyScopes={REGIME_REVIEW_SCOPES}
      />
    </AnalysisPageFrame>
  );
}
