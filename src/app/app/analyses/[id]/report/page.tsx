import Link from "next/link";
import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { AnalysisRunState } from "@/components/dashboard/analysis-run-state";
import { DiagnosticFigure } from "@/components/dashboard/diagnostic-figure";
import { FigureCard } from "@/components/dashboard/figure-card";
import { MetricRow } from "@/components/dashboard/metric-row";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { ContextFlipCard } from "@/components/dashboard/context-flip-card";
import { AiSynthesisPanel } from "@/components/dashboard/ai-synthesis-panel";
import { EvidenceStatePanel, EvidenceStatusBadge, normalizeEvidenceState } from "@/components/dashboard/evidence-status";
import { ResearchDeskRequestPanel } from "@/components/dashboard/research-desk-request-panel";
import { ReportExportActions } from "@/components/dashboard/report-export-actions";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { logAnalysisPageDebug } from "@/lib/app/analysis-page-debug";
import { buildDecisionSnapshotMetrics, buildReportViewModel } from "@/lib/app/report-view";
import { metricsFromScoreBands } from "@/lib/app/analysis-ui";
import { buildTruthContext } from "@/lib/app/context-truth";
import type { FigurePayload } from "@/lib/contracts";
import { mapOverviewBenchmarkPayload } from "@/lib/diagnostics/overview/map-benchmark-payload";
import { requireServerSession } from "@/lib/server/auth/session";
import { accountService } from "@/lib/server/accounts/service";
import { getReportSnapshotState } from "@/lib/server/exports/report-snapshot-service";
import { listApprovedReportAddenda } from "@/lib/server/research-desk/research-desk-service";
import { requireOwnedAnalysisView } from "@/lib/server/services/analysis-view-service";

function BulletList({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) return <p className="text-sm text-text-neutral">{empty}</p>;
  return (
    <ul className="space-y-2 text-sm text-text-neutral">
      {items.map((item, index) => <li key={`bullet-${index}-${item.slice(0, 24)}`}>• {item}</li>)}
    </ul>
  );
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

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const accountState = await accountService.getAccountState(session.account_id);
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
  const snapshotState = getReportSnapshotState(analysis);
  const approvedAddenda = snapshotState.active ? listApprovedReportAddenda(snapshotState.active.snapshot_id) : [];
  const decisionMetrics = buildDecisionSnapshotMetrics(record);
  const benchmark = mapOverviewBenchmarkPayload(record.engine_payload.diagnostics.overview);
  const reportBranch = view.charts.length > 0 ? "native_figures_branch" : "empty_state_branch";
  const truthContext = buildTruthContext(record, "report", { benchmark: analysis.benchmark });
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
          <p><span className="font-medium text-text-graphite">Engine seam:</span> {analysis.engine_context?.seam ?? "N/A"}</p>
        </div>
        {snapshotState.warnings.length ? (
          <div className="border-t border-border-subtle bg-evidence-limited-wash px-6 py-3 text-sm text-evidence-limited">
            <p className="font-provenance text-[10px] uppercase tracking-[0.12em]">Snapshot warning</p>
            <p className="mt-1">{snapshotState.warnings[0]}</p>
          </div>
        ) : null}
      </section>

      <WorkspaceCard title="Executive Summary" subtitle="Institutional validation memo — final deployment decision artifact">
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-graphite">Validation report</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-text-institutional">{record.strategy.strategy_name}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-text-neutral">{record.report.executive_summary}</p>
            </div>
            </div>

          <div className="grid gap-3 rounded-md border border-border/80 bg-surface-subtle p-4 text-sm text-text-neutral md:grid-cols-2 xl:grid-cols-4">
            <p><span className="font-medium text-text-graphite">Asset / Market:</span> {record.dataset.market ?? "N/A"}</p>
            <p><span className="font-medium text-text-graphite">Timeframe:</span> {record.strategy.timeframe ?? "N/A"}</p>
            <p><span className="font-medium text-text-graphite">Coverage:</span> {record.dataset.start_date ?? "N/A"} → {record.dataset.end_date ?? "N/A"}</p>
            <p><span className="font-medium text-text-graphite">Trades:</span> {record.dataset.trade_count.toLocaleString()}</p>
            <p className="md:col-span-2"><span className="font-medium text-text-graphite">Verdict:</span> {view.verdict.statusLabel} — {view.verdict.headline}</p>
            <p><span className="font-medium text-text-graphite">Generated:</span> {record.report.generated_at ?? record.updated_at}</p>
            <p><span className="font-medium text-text-graphite">Scope:</span> Free diagnostic preview</p>
          </div>
        </div>
      </WorkspaceCard>

      <WorkspaceCard title="Export & Sharing" subtitle="Generate a polished report artifact for a committee, allocator, buyer, or internal review packet.">
        <ReportExportActions
          analysisId={record.analysis_id}
          canExport={record.access.can_export_report}
          currentPlan={accountState?.account.plan_id}
        />
      </WorkspaceCard>

      <WorkspaceCard title="Decision Snapshot" subtitle="Highest-signal deployment metrics">
        <MetricRow metrics={metricsFromScoreBands(decisionMetrics)} cols={6} />
      </WorkspaceCard>

      <div className="grid gap-4 md:grid-cols-3">
        <EvidenceStatePanel state={normalizeEvidenceState(view.verdict.posture)} title="Verdict evidence" body={view.verdict.summary} reasonCode="report.verdict" />
        <EvidenceStatePanel state={view.limitations.length ? "limited" : "supported"} title="Primary limitation" body={view.limitations[0] ?? "No explicit report limitations were emitted."} reasonCode="report.limitation" />
        <EvidenceStatePanel state="processing" title="Next action" body={view.deploymentGuidance.nextActions[0] ?? "Generate a share-safe report snapshot or request deeper validation."} reasonCode="report.next" />
      </div>

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
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-graphite">Next actions</p>
              <BulletList items={view.deploymentGuidance.nextActions} empty="No next actions were emitted." />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-graphite">Metrics driving posture</p>
              <BulletList items={decisionMetrics.slice(0, 5).map((metric) => `${metric.label}: ${metric.value}`)} empty="No decision metrics were available." />
            </div>
          </div>
          <p className="mt-4 text-sm text-text-neutral"><span className="font-medium text-text-graphite">Deterministic verdict:</span> {view.verdict.statusLabel} — {view.verdict.headline}</p>
          <p className="mt-2 text-sm text-text-neutral">{view.verdict.summary}</p>
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

      <WorkspaceCard title="Regime / Stability / Conditionality" subtitle="Edge concentration, generalization risk, and conditionality diagnostics">
        <div className="grid gap-4 md:grid-cols-2">
          <BulletList items={[
            ...record.diagnostics.regimes.metrics.map((metric) => `${metric.label}: ${metric.value}`),
            ...record.diagnostics.stability.metrics.map((metric) => `${metric.label}: ${metric.value}`),
          ]} empty="Regime and stability metrics were not emitted for this run." />
          <p className="text-sm text-text-neutral">{record.diagnostics.regimes.interpretation.summary} {record.diagnostics.stability.interpretation.summary}</p>
        </div>
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

      <WorkspaceCard title="Deeper Validation Path" subtitle="Decision-grade audit scope beyond the free diagnostic layer">
        <p className="max-w-3xl text-sm leading-relaxed text-text-neutral">
          Deeper validation extends the lab output into a structured audit: parameter stability, regime-conditioned performance, execution stress testing, and capital-risk interpretation are reviewed together to test whether the modeled edge remains durable under institutional scrutiny.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-md border border-border-subtle bg-surface-subtle p-4">
            <p className="text-sm font-semibold text-text-institutional">Parameter Stability</p>
            <p className="mt-2 text-sm text-text-neutral">Tests whether performance remains durable as core parameters shift.</p>
            <p className="mt-2 text-xs text-text-neutral">Why it matters: guards against parameter luck and narrow optimization.</p>
          </div>
          <div className="rounded-md border border-border-subtle bg-surface-subtle p-4">
            <p className="text-sm font-semibold text-text-institutional">Regime Analysis</p>
            <p className="mt-2 text-sm text-text-neutral">Evaluates behavior across volatility and trend-state transitions.</p>
            <p className="mt-2 text-xs text-text-neutral">Why it matters: verifies edge persistence outside favorable windows.</p>
          </div>
        </div>
        <div className="mt-4">
          <Link href="/contact" className={buttonVariants()}>Request Validation Audit</Link>
        </div>
      </WorkspaceCard>

      <ResearchDeskRequestPanel analysisId={record.analysis_id} limitations={researchDeskLimitations} />

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
