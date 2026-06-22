import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { AnalysisRunState } from "@/components/dashboard/analysis-run-state";
import { AnalystWorkbenchPanel } from "@/components/dashboard/analyst-workbench";
import { EvidenceList } from "@/components/dashboard/evidence-list";
import { EvidenceStatusBadge, type EvidenceState } from "@/components/dashboard/evidence-status";
import { ResearchDeskRequestPanel } from "@/components/dashboard/research-desk-request-panel";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { buildAnalystWorkbenchModel } from "@/lib/app/analyst-workbench";
import { requireServerSession } from "@/lib/server/auth/session";
import { requireOwnedAnalysisView } from "@/lib/server/services/analysis-view-service";

function titleCase(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusTone(status: string): EvidenceState {
  if (status === "supported") return "supported";
  if (status === "partially_supported") return "limited";
  if (status === "contradicted") return "unsupported";
  return "unsupported";
}

export default async function AssumptionLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const { id } = await params;
  const { analysis, record } = await requireOwnedAnalysisView(id, session.account_id);

  if (!record) {
    return (
      <AnalysisPageFrame title="Assumption Ledger" description="Source-linked assumptions, unsupported claims, and rescue evidence for this validation run.">
        <AnalysisRunState analysis={analysis} />
      </AnalysisPageFrame>
    );
  }

  const assumptions = record.assumption_ledger ?? [];
  const claims = record.claim_inventory ?? [];
  const evidenceFacts = record.evidence_facts ?? [];
  const proofReport = record.proof_report;
  const criticalAssumptions = assumptions.filter((item) => item.materiality === "critical" || item.materiality === "high");
  const unsupportedClaims = claims.filter((claim) => ["unsupported", "contradicted"].includes(claim.support_status));
  const researchDeskLimitations = [
    ...criticalAssumptions.map((assumption) => assumption.rescue_evidence ?? assumption.statement),
    ...unsupportedClaims.map((claim) => claim.report_wording || claim.claim),
    ...(proofReport?.what_this_result_does_not_prove ?? []),
  ];

  return (
    <AnalysisPageFrame title="Assumption Ledger" description="Every important assumption, claim, missing input, and rescue path that constrains this report.">
      <AnalystWorkbenchPanel model={buildAnalystWorkbenchModel(record, "assumptions")} />

      <section className="grid gap-4 md:grid-cols-3">
        <WorkspaceCard title="Critical assumptions" subtitle="High-materiality conditions behind the verdict">
          <p className="font-display text-4xl text-text-institutional">{criticalAssumptions.length}</p>
          <p className="mt-2 text-sm text-text-neutral">Assumptions that can materially move the validation result.</p>
        </WorkspaceCard>
        <WorkspaceCard title="Unsupported claims" subtitle="Claims the artifact cannot yet prove">
          <p className="font-display text-4xl text-text-institutional">{unsupportedClaims.length}</p>
          <p className="mt-2 text-sm text-text-neutral">Claims that need more evidence, a narrower wording, or Expert Review.</p>
        </WorkspaceCard>
        <WorkspaceCard title="Evidence facts" subtitle="Accepted facts extracted from the artifact chain">
          <p className="font-display text-4xl text-text-institutional">{evidenceFacts.length}</p>
          <p className="mt-2 text-sm text-text-neutral">Facts available to diagnostics and report generation.</p>
        </WorkspaceCard>
      </section>

      <WorkspaceCard title="Assumption Ledger" subtitle="Source, materiality, affected metrics, and rescue evidence">
        {assumptions.length ? (
          <div className="space-y-3">
            {assumptions.map((assumption) => (
              <div key={assumption.assumption_id} className="rounded-md border border-border-subtle bg-surface-subtle p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">{assumption.assumption_id} / {assumption.source} / {assumption.diagnostic}</p>
                    <p className="mt-2 text-sm font-medium text-text-institutional">{assumption.statement}</p>
                  </div>
                  <EvidenceStatusBadge state={assumption.materiality === "critical" ? "unsupported" : assumption.materiality === "high" ? "limited" : "supported"} label={titleCase(assumption.materiality)} compact />
                </div>
                {assumption.affected_metrics?.length ? <p className="mt-3 text-xs text-text-neutral">Affected: {assumption.affected_metrics.join(", ")}</p> : null}
                {assumption.rescue_evidence ? <p className="mt-2 text-sm text-text-neutral"><span className="font-medium text-text-graphite">Rescue evidence:</span> {assumption.rescue_evidence}</p> : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-neutral">No normalized assumptions were emitted for this run.</p>
        )}
      </WorkspaceCard>

      <WorkspaceCard title="Claim Inventory" subtitle="What the run supports, weakens, or refuses to prove">
        {claims.length ? (
          <div className="space-y-3">
            {claims.map((claim) => (
              <div key={claim.claim_id} className="rounded-md border border-border-subtle bg-surface-subtle p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">{claim.claim_id} / {claim.source}</p>
                    <p className="mt-2 text-sm font-medium text-text-institutional">{claim.claim}</p>
                  </div>
                  <EvidenceStatusBadge state={statusTone(claim.support_status)} label={titleCase(claim.support_status)} compact />
                </div>
                <p className="mt-2 text-sm text-text-neutral">{claim.report_wording}</p>
                {claim.missing_evidence.length ? <p className="mt-2 text-xs text-text-neutral">Missing evidence: {claim.missing_evidence.join(", ")}</p> : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-neutral">No claim inventory was emitted for this run.</p>
        )}
      </WorkspaceCard>

      <WorkspaceCard title="What This Result Does Not Prove" subtitle="Report-safe boundaries carried into export and sharing">
        {proofReport?.what_this_result_does_not_prove?.length ? (
          <EvidenceList items={proofReport.what_this_result_does_not_prove} empty="No explicit proof-report exclusions were emitted." tone="warning" />
        ) : (
          <p className="text-sm text-text-neutral">No explicit proof-report exclusions were emitted.</p>
        )}
      </WorkspaceCard>

      <ResearchDeskRequestPanel
        analysisId={record.analysis_id}
        limitations={researchDeskLimitations}
        defaultServices={["claim_validation", "parameter_stability_review", "investor_buyer_memo_review"]}
      />
    </AnalysisPageFrame>
  );
}
