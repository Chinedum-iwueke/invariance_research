import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { AnalysisRunState } from "@/components/dashboard/analysis-run-state";
import { AnalystWorkbenchPanel } from "@/components/dashboard/analyst-workbench";
import { DiagnosticFigure } from "@/components/dashboard/diagnostic-figure";
import { FigureCard } from "@/components/dashboard/figure-card";
import { MetricRow } from "@/components/dashboard/metric-row";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { ContextFlipCard } from "@/components/dashboard/context-flip-card";
import { AiSynthesisPanel } from "@/components/dashboard/ai-synthesis-panel";
import { EvidenceStatusBadge, normalizeEvidenceState } from "@/components/dashboard/evidence-status";
import { EvidenceList } from "@/components/dashboard/evidence-list";
import { ResearchDeskRequestPanel } from "@/components/dashboard/research-desk-request-panel";
import { ReportExportActions } from "@/components/dashboard/report-export-actions";
import { ReportShareActions } from "@/components/dashboard/report-share-actions";
import { cn } from "@/lib/utils";
import { logAnalysisPageDebug } from "@/lib/app/analysis-page-debug";
import { buildAnalystWorkbenchModel } from "@/lib/app/analyst-workbench";
import { buildDecisionSnapshotMetrics, buildReportViewModel } from "@/lib/app/report-view";
import { metricsFromScoreBands } from "@/lib/app/analysis-ui";
import { buildTruthContext } from "@/lib/app/context-truth";
import type { FigurePayload } from "@/lib/contracts";
import { mapOverviewBenchmarkPayload } from "@/lib/diagnostics/overview/map-benchmark-payload";
import { requireServerSession } from "@/lib/server/auth/session";
import { isAdminIdentity } from "@/lib/server/admin/guards";
import { accountService } from "@/lib/server/accounts/service";
import { getReportSnapshotState } from "@/lib/server/exports/report-snapshot-service";
import { getValidationCommandLayer } from "@/lib/server/evidence/validation-command-service";
import { listApprovedReportAddenda, listResearchDeskRequestsForAnalysis } from "@/lib/server/research-desk/research-desk-service";
import { requireOwnedAnalysisView } from "@/lib/server/services/analysis-view-service";
import type { CaseFileTimelineEvent, ValidationExplanation } from "@/lib/app/validation-command-layer";

function BulletList({ items, empty }: { items: string[]; empty: string }) {
  return <EvidenceList items={items} empty={empty} tone="neutral" limit={8} />;
}

function SectionFigure({ title, subtitle, figure }: { title: string; subtitle: string; figure?: FigurePayload }) {
  if (!figure) {
    return (
      <WorkspaceCard title={title} subtitle={subtitle}>
        <p className="text-sm text-text-neutral">Figure unavailable for this run. Narrative and metrics remain included.</p>
      </WorkspaceCard>
    );
  }

  return (
    <FigureCard
      title={title}
      subtitle={subtitle}
      figure={<DiagnosticFigure figure={figure} height={480} />}
    />
  );
}

function TimelineList({ items, empty }: { items: CaseFileTimelineEvent[]; empty: string }) {
  if (!items.length) return <p className="text-sm text-text-neutral">{empty}</p>;
  return (
    <ol className="space-y-3">
      {items.map((item) => (
        <li key={item.id} className="rounded-md border border-border-subtle bg-surface-subtle p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-text-institutional">{item.title}</p>
            <time className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">{new Date(item.created_at).toLocaleString()}</time>
          </div>
          <p className="mt-2 text-sm leading-6 text-text-neutral">{item.summary}</p>
        </li>
      ))}
    </ol>
  );
}

function ExplainList({ items }: { items: ValidationExplanation[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {items.map((item) => (
        <div key={item.id} id={item.id === "why_verdict" ? "explain-verdict" : undefined} className="rounded-md border border-border-subtle bg-surface-subtle p-4">
          <p className="text-sm font-semibold text-text-institutional">{item.question}</p>
          <p className="mt-2 text-sm leading-6 text-text-neutral">{item.answer}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {item.reason_codes.slice(0, 4).map((code, index) => (
              <code key={`${code}-${index}`} className="rounded-sm border border-border-subtle bg-surface-white px-2 py-1 font-provenance text-[10px] text-text-neutral">{code}</code>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const accountState = await accountService.getAccountState(session.account_id);
  const isAdmin = await isAdminIdentity({ user_id: session.user_id, email: session.email });
  const { id } = await params;
  const { analysis, record } = await requireOwnedAnalysisView(id, session.account_id);

  if (!record) {
    return (
      <AnalysisPageFrame title="Validation Report" description="Structured deliverable summarizing strategy robustness, risk posture, and deployment guidance.">
        <AnalysisRunState analysis={analysis} />
      </AnalysisPageFrame>
    );
  }

  const view = buildReportViewModel(record);
  const snapshotState = await getReportSnapshotState(analysis);
  const commandLayer = await getValidationCommandLayer({ analysis_id: analysis.analysis_id, account_id: session.account_id });
  const approvedAddenda = snapshotState.active ? await listApprovedReportAddenda(snapshotState.active.snapshot_id) : [];
  const researchDeskRequests = await listResearchDeskRequestsForAnalysis({ analysis_id: analysis.analysis_id, account_id: session.account_id });
  const decisionMetrics = buildDecisionSnapshotMetrics(record);
  const benchmark = mapOverviewBenchmarkPayload(record.engine_payload.diagnostics.overview);
  const reportBranch = view.charts.length > 0 ? "native_figures_branch" : "empty_state_branch";
  const truthContext = buildTruthContext(record, "report", { benchmark: analysis.benchmark });
  const workbench = buildAnalystWorkbenchModel(record, "report", { benchmark: analysis.benchmark });
  const researchDeskLimitations = [
    ...view.limitations,
    ...truthContext.limitations,
    ...record.summary.warnings.map((warning) => `${warning.title}: ${warning.message}`),
  ];
  const readinessTone = view.deploymentGuidance.status === "advisable"
    ? {
        border: "border-chart-positive/35",
        bg: "bg-chart-positive/10",
        text: "text-chart-positive",
        badge: "border-chart-positive/25 bg-chart-positive/10 text-chart-positive",
        icon: CheckCircle2,
      }
    : view.deploymentGuidance.status === "conditional"
      ? {
          border: "border-amber-500/35",
          bg: "bg-amber-500/10",
          text: "text-amber-700",
          badge: "border-amber-500/25 bg-amber-500/10 text-amber-800",
          icon: AlertTriangle,
        }
      : {
          border: "border-chart-negative/35",
          bg: "bg-chart-negative/10",
          text: "text-chart-negative",
          badge: "border-chart-negative/25 bg-chart-negative/10 text-chart-negative",
          icon: ShieldAlert,
        };
  const ReadinessIcon = readinessTone.icon;

  logAnalysisPageDebug({
    analysis_id: record.analysis_id,
    page: "report",
    input_figure_count: record.report.figures.length,
    input_figure_types: record.report.figures.map((figure) => figure.type),
    singular_figure_present: false,
    fallback_figure_source_available: false,
    selected_figure_count: view.charts.length,
    selected_figure_types: view.charts.map((figure) => figure.type),
    branch: reportBranch,
    empty_state_reason: reportBranch === "empty_state_branch"
      ? "curated chart selection returned no non-empty figures (empty series or de-duplication filtered all candidates)"
      : undefined,
  });

  return (
    <AnalysisPageFrame title="Validation Report" description="Immutable-style validation artifact with executive posture, evidence boundaries, survivability diagnostics, and benchmark context.">
      <AnalystWorkbenchPanel model={workbench} />

      <section className="artifact-surface overflow-hidden">
        <div className="grid gap-6 border-b border-border-subtle bg-surface-subtle px-6 py-5 lg:grid-cols-[1fr_auto] lg:items-start">
          <div>
            <p className="font-provenance text-[11px] uppercase tracking-[0.12em] text-text-neutral">
              Report snapshot / {snapshotState.active ? snapshotState.active.snapshot_id.slice(0, 8) : "not generated"}
            </p>
            <h2 className="font-display mt-2 text-[clamp(2.4rem,5vw,4.5rem)] leading-none tracking-normal text-text-institutional">{record.strategy.strategy_name}</h2>
            <p className="mt-4 max-w-4xl text-sm leading-7 text-text-neutral">{record.report.executive_summary}</p>
          </div>
          <div className="flex flex-col items-start gap-2 lg:items-end">
            <EvidenceStatusBadge state={normalizeEvidenceState(view.deploymentGuidance.status)} label={view.deploymentGuidance.advisoryLabel} />
            <code className="font-provenance rounded-sm border border-border-subtle bg-surface-paper px-2 py-1 text-[11px] text-text-neutral">analysis={record.analysis_id.slice(0, 8)}</code>
          </div>
        </div>
        <div className="grid gap-3 px-6 py-4 text-sm text-text-neutral md:grid-cols-2 xl:grid-cols-4">
          <p><span className="font-medium text-text-graphite">Generated:</span> {record.report.generated_at ?? record.updated_at}</p>
          <p><span className="font-medium text-text-graphite">Coverage:</span> {record.dataset.start_date ?? "N/A"} &rarr; {record.dataset.end_date ?? "N/A"}</p>
          <p><span className="font-medium text-text-graphite">Trades:</span> {record.dataset.trade_count.toLocaleString()}</p>
          <p><span className="font-medium text-text-graphite">Evidence contract:</span> Evidence-bound validation</p>
        </div>
        {snapshotState.warnings.length ? (
          <div className="border-t border-border-subtle bg-evidence-limited-wash px-6 py-3 text-sm text-evidence-limited">
            <p className="font-provenance text-[10px] uppercase tracking-[0.12em]">Snapshot warning</p>
            <p className="mt-1">{snapshotState.warnings[0]}</p>
          </div>
        ) : null}
      </section>

      <WorkspaceCard title="Decision Snapshot" subtitle="Highest-signal deployment metrics">
        <MetricRow metrics={metricsFromScoreBands(decisionMetrics)} cols={6} />
      </WorkspaceCard>

      <WorkspaceCard title="Verdict & Deployment Readiness" subtitle="Decision framing for allocators and risk committees">
        <div className={cn("rounded-md border px-5 py-5 shadow-sm", readinessTone.border, readinessTone.bg)}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex gap-3">
              <div className={cn("mt-0.5 flex h-10 w-10 items-center justify-center rounded-md border bg-surface-white", readinessTone.border, readinessTone.text)}>
                <ReadinessIcon className="h-5 w-5" />
              </div>
              <div>
                <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em]", readinessTone.badge)}>
                  {view.deploymentGuidance.advisoryLabel}
                </span>
                {record.llm_insights_status === "generated" ? (
                  <span className="ml-2 inline-flex items-center rounded-full border border-teal-700/20 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800">
                    AI-assisted synthesis · {record.llm_insights_model}
                  </span>
                ) : null}
                <h3 className="mt-3 text-2xl font-semibold tracking-tight text-text-institutional">{view.deploymentGuidance.headline}</h3>
                <p className="mt-2 max-w-4xl text-sm leading-relaxed text-text-neutral">{view.deploymentGuidance.summary}</p>
              </div>
            </div>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-graphite">Verdict evidence</p>
              <p className="mt-2 text-sm leading-6 text-text-neutral">{view.verdict.summary}</p>
              {view.limitations[0] ? (
                <div className="mt-4 rounded-md border border-border-subtle bg-surface-white/70 p-3">
                  <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">Primary limitation</p>
                  <p className="mt-2 text-sm leading-6 text-text-neutral">{view.limitations[0]}</p>
                </div>
              ) : null}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-graphite">Next actions</p>
              <EvidenceList items={view.deploymentGuidance.nextActions} empty="No next actions were emitted." tone="positive" limit={4} />
            </div>
          </div>
          <div className="mt-5 rounded-md border border-border-subtle bg-surface-white/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-graphite">Metrics driving posture</p>
            <EvidenceList className="mt-3" items={decisionMetrics.slice(0, 5).map((metric) => `${metric.label}: ${metric.value}`)} empty="No decision metrics were available." />
          </div>
        </div>
      </WorkspaceCard>

      <WorkspaceCard title="Explain Layer" subtitle="Report-safe answers to the questions serious reviewers ask first.">
        <ExplainList items={commandLayer.explanations} />
      </WorkspaceCard>

      <WorkspaceCard title="Evidence Alerts" subtitle="Events that change report trust, access state, or diagnostic confidence.">
        <div id="evidence-alerts">
          <TimelineList items={commandLayer.alerts} empty="No evidence alerts have been emitted yet." />
        </div>
      </WorkspaceCard>

      <WorkspaceCard title="Connected Case File" subtitle="Navigable evidence chain from upload to verdict, snapshot, export, share, and review handoff.">
        <div id="case-file-timeline">
          <TimelineList items={commandLayer.timeline} empty="No case-file events have been emitted yet." />
        </div>
      </WorkspaceCard>

      <WorkspaceCard title="Share-Safe Proof Boundaries" subtitle="Unsupported claims and exclusions that must travel with the memo.">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-md border border-border-subtle bg-surface-subtle p-4">
            <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">Unsupported claims</p>
            <BulletList
              items={(record.claim_inventory ?? [])
                .filter((claim) => ["unsupported", "contradicted", "outside_scope"].includes(claim.support_status))
                .map((claim) => `${claim.claim} — report wording: ${claim.report_wording}`)}
              empty="No unsupported claim was emitted for this run."
            />
          </div>
          <div className="rounded-md border border-border-subtle bg-surface-subtle p-4">
            <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">What this result does not prove</p>
            <BulletList
              items={record.proof_report?.what_this_result_does_not_prove ?? []}
              empty="No explicit proof-report exclusions were emitted."
            />
          </div>
        </div>
      </WorkspaceCard>

      <AiSynthesisPanel
        title="Validation synthesis"
        summary={record.llm_insights?.final_verdict}
        bullets={record.llm_insights?.deployment_readiness_assessment?.blockers}
        model={record.llm_insights_model}
      />

      <WorkspaceCard title="Top-line Performance & Benchmark" subtitle="Return profile, benchmark-relative context, and normalization basis">
        <div className="grid grid-cols-1 gap-6 2xl:grid-cols-1">
          <SectionFigure title="Strategy top-line equity" subtitle="Primary outcome trajectory" figure={view.prioritizedFigures.topLine} />
          <SectionFigure title="Benchmark comparison" subtitle="Strategy vs selected benchmark" figure={view.prioritizedFigures.benchmark ?? benchmark?.figure} />
        </div>
        {benchmark?.summary_metrics ? (
          <div className="mt-4 grid gap-3 text-sm text-text-neutral md:grid-cols-2 xl:grid-cols-3">
            <p><span className="font-medium text-text-graphite">Strategy Return:</span> {benchmark.summary_metrics.strategy_return ?? "N/A"}</p>
            <p><span className="font-medium text-text-graphite">Benchmark Return:</span> {benchmark.summary_metrics.benchmark_return ?? "N/A"}</p>
            <p><span className="font-medium text-text-graphite">Excess Return:</span> {benchmark.summary_metrics.excess_return_vs_benchmark ?? "N/A"}</p>
            <p><span className="font-medium text-text-graphite">Window:</span> {benchmark.metadata?.comparison_window_start ?? "N/A"} → {benchmark.metadata?.comparison_window_end ?? "N/A"}</p>
            <p><span className="font-medium text-text-graphite">Normalization:</span> {benchmark.metadata?.normalization_basis ?? benchmark.metadata?.alignment_basis ?? "N/A"}</p>
            <p><span className="font-medium text-text-graphite">Benchmark Assumptions:</span> {benchmark.assumptions[0] ?? "Engine-native benchmark alignment"}</p>
          </div>
        ) : <p className="mt-3 text-sm text-text-neutral">Benchmark comparison was not available for this run; core strategy diagnostics are still included.</p>}
      </WorkspaceCard>

      <WorkspaceCard title="Risk & Survivability" subtitle="Ruin profile, drawdown burden, and capital survivability implications">
        <div className="grid grid-cols-1 gap-6 2xl:grid-cols-1">
          <SectionFigure title="Ruin / survivability curve" subtitle="Capital stress and ruin sensitivity" figure={view.prioritizedFigures.survivability} />
          <div className="space-y-3 rounded-md border border-border/80 bg-surface-subtle p-4">
            <p className="text-sm font-semibold text-text-institutional">Capital survivability translation</p>
            <BulletList items={record.diagnostics.ruin.metrics.map((metric) => `${metric.label}: ${metric.value}`)} empty="No ruin metrics emitted." />
            <p className="text-sm text-text-neutral">Interpretation: {record.diagnostics.ruin.interpretation.summary}</p>
          </div>
        </div>
      </WorkspaceCard>

      <WorkspaceCard title="Distribution & Trade Behavior" subtitle="How the strategy earns, loses, and behaves across trade cohorts">
        <div className="grid grid-cols-1 gap-6 2xl:grid-cols-1">
          {view.prioritizedFigures.distribution.map((figure) => (
            <FigureCard key={figure.figure_id} title={figure.title} subtitle={figure.subtitle ?? "Distribution diagnostic"} figure={<DiagnosticFigure figure={figure} height={480} />} />
          ))}
        </div>
        {!view.prioritizedFigures.distribution.length ? <p className="text-sm text-text-neutral">Distribution charts were unavailable for this run.</p> : null}
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <BulletList items={record.diagnostics.distribution.metrics.map((metric) => `${metric.label}: ${metric.value}`)} empty="No distribution metrics emitted." />
          <p className="text-sm text-text-neutral">Payoff profile interpretation: {record.diagnostics.distribution.interpretation.summary}</p>
        </div>
      </WorkspaceCard>

      <WorkspaceCard title="Monte Carlo & Tail Risk" subtitle="Path dependence, sequence fragility, and drawdown envelope">
        <div className="grid grid-cols-1 gap-6 2xl:grid-cols-1">
          <SectionFigure title="Monte Carlo fan / tail profile" subtitle="Simulation path envelope" figure={view.prioritizedFigures.monteCarlo} />
          <div className="space-y-2 rounded-md border border-border/80 bg-surface-subtle p-4">
            <BulletList items={record.diagnostics.monte_carlo.metrics.map((metric) => `${metric.label}: ${metric.value}`)} empty="No Monte Carlo metrics emitted." />
            <p className="text-sm text-text-neutral">Simulation interpretation: {record.diagnostics.monte_carlo.interpretation.summary}</p>
          </div>
        </div>
      </WorkspaceCard>

      <WorkspaceCard title="Execution Sensitivity" subtitle="Whether execution friction erodes or preserves the modeled edge">
        <div className="grid grid-cols-1 gap-6 2xl:grid-cols-1">
          <SectionFigure title="Execution expectancy decay" subtitle="Baseline vs stressed edge" figure={view.prioritizedFigures.execution} />
          <div className="space-y-2 rounded-md border border-border/80 bg-surface-subtle p-4">
            <BulletList items={record.diagnostics.execution.metrics.map((metric) => `${metric.label}: ${metric.value}`)} empty="No execution metrics emitted." />
            <p className="text-sm text-text-neutral">Deterministic assumption disclosure: {record.diagnostics.execution.assumptions?.[0] ?? "Execution assumptions were not explicitly emitted."}</p>
          </div>
        </div>
      </WorkspaceCard>

      <WorkspaceCard title="Deferred Review Scopes" subtitle="High-risk claims that should not be automated from this upload alone.">
        <BulletList
          items={[
            "True parameter stability requires a coherent multi-run sweep and reviewer validation of the run-to-parameter mapping.",
            "Multi-asset regime attribution requires explicit symbol coverage, timestamp alignment, and regime definitions.",
            "Broker-level execution realism, strategy reconstruction, and portfolio exposure analysis should route to Research Desk when the upload evidence is incomplete.",
          ]}
          empty="No deferred review scopes were emitted."
        />
      </WorkspaceCard>

      <ContextFlipCard
        title="Methodology boundaries, limitations, and actions"
        subtitle="Unified truth-based context for assumptions, warnings, and recommended actions."
        panes={[
          { key: "assumptions", label: "Assumptions", items: [...truthContext.assumptions, ...view.methodology], empty: "No methodology assumptions were emitted.", tone: "neutral" },
          { key: "limitations", label: "Limitations", items: [...truthContext.limitations, ...record.summary.warnings.map((warning) => `${warning.title}: ${warning.message}`)], empty: "No explicit limitations were emitted.", tone: "warning" },
          { key: "recommendations", label: "Recommendations", items: [...truthContext.recommendations, ...view.recommendations], empty: "No recommendations were emitted.", tone: "positive" },
        ]}
      />

      <WorkspaceCard title="Export & Sharing" subtitle="Generate a polished report artifact for a committee, allocator, buyer, or internal review packet.">
        <div className="space-y-4">
          <ReportExportActions
            analysisId={record.analysis_id}
            canExport={isAdmin || record.access.can_export_report}
            currentPlan={accountState?.account.plan_id}
          />
          <ReportShareActions analysisId={record.analysis_id} initialSnapshotId={snapshotState.active?.snapshot_id} />
        </div>
      </WorkspaceCard>

      <ResearchDeskRequestPanel analysisId={record.analysis_id} limitations={researchDeskLimitations} />

      {researchDeskRequests.length ? (
        <WorkspaceCard title="Research Desk Timeline" subtitle="Client-visible status for review requests tied to this analysis">
          <div className="space-y-4">
            {researchDeskRequests.map(({ request, timeline }) => (
              <div key={request.request_id} className="rounded-md border border-border-subtle bg-surface-subtle p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-text-institutional">{request.trigger_limitation}</p>
                  <code className="text-xs text-text-neutral">request={request.request_id.slice(0, 8)}</code>
                </div>
                <ol className="mt-4 grid gap-2 md:grid-cols-4">
                  {timeline.map((event) => (
                    <li key={`${request.request_id}-${event.status}`} className={cn(
                      "rounded-sm border p-3 text-xs",
                      event.state === "complete" ? "border-chart-positive/30 bg-chart-positive/10 text-chart-positive" : event.state === "current" ? "border-research-red/30 bg-research-red/10 text-research-red" : "border-border-subtle bg-surface-white text-text-neutral",
                    )}>
                      <p className="font-semibold">{event.label}</p>
                      <p className="mt-1 leading-5">{event.description}</p>
                      {event.at ? <time className="mt-2 block font-provenance text-[10px] uppercase tracking-[0.12em]">{new Date(event.at).toLocaleString()}</time> : null}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </WorkspaceCard>
      ) : null}

      {approvedAddenda.length ? (
        <WorkspaceCard title="Reviewer Addenda" subtitle="Approved Research Desk context attached to this report snapshot">
          <div className="space-y-3">
            {approvedAddenda.map((addendum) => (
              <div key={addendum.addendum_id} className="rounded-md border border-research-red/20 bg-research-red/5 p-4">
                <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-research-red">
                  Approved addendum / {addendum.approved_at ?? addendum.updated_at}
                </p>
                <p className="mt-2 text-sm leading-7 text-text-neutral">{addendum.public_addendum}</p>
              </div>
            ))}
          </div>
        </WorkspaceCard>
      ) : null}
    </AnalysisPageFrame>
  );
}
