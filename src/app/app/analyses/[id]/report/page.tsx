import Link from "next/link";
import { AlertTriangle, BadgeCheck, CalendarDays, Download, ShieldAlert, ShieldCheck } from "lucide-react";
import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { AnalysisRunState } from "@/components/dashboard/analysis-run-state";
import { DiagnosticFigure } from "@/components/dashboard/diagnostic-figure";
import { FigureCard } from "@/components/dashboard/figure-card";
import { MetricRow } from "@/components/dashboard/metric-row";
import { ReportExportActions } from "@/components/dashboard/report-export-actions";
import { UpgradePanel } from "@/components/dashboard/upgrade-panel";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { ContextFlipCard } from "@/components/dashboard/context-flip-card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { logAnalysisPageDebug } from "@/lib/app/analysis-page-debug";
import { buildDecisionSnapshotMetrics, buildReportViewModel } from "@/lib/app/report-view";
import { metricsFromScoreBands } from "@/lib/app/analysis-ui";
import { buildTruthContext } from "@/lib/app/context-truth";
import type { FigurePayload } from "@/lib/contracts";
import { mapOverviewBenchmarkPayload } from "@/lib/diagnostics/overview/map-benchmark-payload";
import { accountService } from "@/lib/server/accounts/service";
import { isAdminIdentity } from "@/lib/server/admin/guards";
import { requireServerSession } from "@/lib/server/auth/session";
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
      note={figure.note}
    />
  );
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const isAdmin = isAdminIdentity({ user_id: session.user_id, email: session.email });
  const state = accountService.getAccountState(session.account_id);
  const { id } = await params;
  const { analysis, record } = requireOwnedAnalysisView(id, session.account_id);
  const canExport = isAdmin || (state?.entitlements.can_export_report ?? false);
  const canViewFull = isAdmin || (state?.entitlements.can_view_full_report ?? false);

  if (!record) {
    return (
      <AnalysisPageFrame title="Validation Report" description="Structured deliverable summarizing strategy robustness, risk posture, and deployment guidance.">
        <AnalysisRunState analysis={analysis} />
      </AnalysisPageFrame>
    );
  }

  const view = buildReportViewModel(record);
  const decisionMetrics = buildDecisionSnapshotMetrics(record);
  const benchmark = mapOverviewBenchmarkPayload(record.engine_payload.diagnostics.overview);
  const reportBranch = view.charts.length > 0 ? "native_figures_branch" : "empty_state_branch";
  const truthContext = buildTruthContext(record, "report");

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
    <AnalysisPageFrame title="Validation Report" description="Institutional validation deliverable with executive posture, confidence, survivability diagnostics, benchmark context, and exportable board-ready reporting.">
      <WorkspaceCard title="Executive Summary" subtitle="Institutional validation memo — final deployment decision artifact">
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-graphite">Validation report</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-text-institutional">{record.strategy.strategy_name}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-text-neutral">{record.report.executive_summary}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href="#report-export" className={buttonVariants({ variant: "secondary" })}><Download className="mr-2 h-4 w-4" />Download PDF</a>
              <Link href={`/api/analyses/${record.analysis_id}`} className={buttonVariants({ variant: "secondary" })}>Raw payload</Link>
            </div>
          </div>

          <div className="grid gap-3 rounded-md border border-border/80 bg-surface-subtle p-4 text-sm text-text-neutral md:grid-cols-2 xl:grid-cols-4">
            <p><span className="font-medium text-text-graphite">Asset / Market:</span> {record.dataset.market ?? "N/A"}</p>
            <p><span className="font-medium text-text-graphite">Timeframe:</span> {record.strategy.timeframe ?? "N/A"}</p>
            <p><span className="font-medium text-text-graphite">Coverage:</span> {record.dataset.start_date ?? "N/A"} → {record.dataset.end_date ?? "N/A"}</p>
            <p><span className="font-medium text-text-graphite">Trades:</span> {record.dataset.trade_count.toLocaleString()}</p>
            <p className="md:col-span-2"><span className="font-medium text-text-graphite">Verdict:</span> {view.verdict.statusLabel} — {view.verdict.headline}</p>
            <p><span className="font-medium text-text-graphite">Generated:</span> {record.report.generated_at ?? record.updated_at}</p>
            <p><span className="font-medium text-text-graphite">Scope:</span> {canViewFull ? "Full diagnostic suite" : "Limited report scope"}</p>
          </div>
        </div>
      </WorkspaceCard>

      {!canViewFull ? (
        <UpgradePanel
          title="Full report depth is plan-gated"
          explanation="Your current plan includes a limited report view. Upgrade when you need expanded diagnostic sections and complete exportable reporting."
          planHint="Full report view and exports are available on Professional and above."
        />
      ) : null}

      <WorkspaceCard title="Decision Snapshot" subtitle="Highest-signal deployment metrics">
        <MetricRow metrics={metricsFromScoreBands(decisionMetrics)} cols={6} />
      </WorkspaceCard>

      <WorkspaceCard title="Verdict & Deployment Readiness" subtitle="Decision framing for allocators and risk committees">
        <div className={cn("rounded-md border px-5 py-4", view.deploymentGuidance.advisable ? "border-chart-positive/25 bg-chart-positive/10" : "border-chart-negative/25 bg-chart-negative/10")}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-xl font-semibold text-text-institutional">{view.verdict.statusLabel}: {view.verdict.headline}</h3>
            <span className="inline-flex items-center gap-2 rounded-full border border-text-institutional/20 bg-surface-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-text-institutional">
              {view.verdict.posture === "robust" ? <ShieldCheck className="h-4 w-4" /> : view.verdict.posture === "moderate" ? <BadgeCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
              {view.deploymentGuidance.advisoryLabel}
            </span>
          </div>
          <p className="mt-2 text-sm text-text-neutral">{view.verdict.summary}</p>
          <p className="mt-3 text-sm text-text-neutral"><span className="font-medium text-text-graphite">What this means:</span> {view.deploymentGuidance.summary}</p>
        </div>
      </WorkspaceCard>

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
            <FigureCard key={figure.figure_id} title={figure.title} subtitle={figure.subtitle ?? "Distribution diagnostic"} figure={<DiagnosticFigure figure={figure} height={480} />} note={figure.note} />
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

      <WorkspaceCard title="Export & Share" subtitle="Client-ready PDF artifact and raw payload access" note="The report download continues even if an individual chart cannot be embedded.">
        <div id="report-export">
          <ReportExportActions analysisId={record.analysis_id} canExport={canExport} currentPlan={state?.account.plan_id} />
        </div>
        <div className="mt-4 border-t pt-3">
          <p className="text-xs text-text-neutral">Polished PDF export is the primary client deliverable. Raw payload access remains available for audit transparency and downstream analyst workflows.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link href="/contact" className={buttonVariants()}>
              Need an independent validation audit?
            </Link>
            <span className="inline-flex items-center gap-1 text-xs text-text-neutral"><CalendarDays className="h-3.5 w-3.5" /> Export links expire automatically based on retention policy.</span>
            <span className="inline-flex items-center gap-1 text-xs text-text-neutral"><AlertTriangle className="h-3.5 w-3.5" /> Download retry is safe; failed exports surface explicit error messages.</span>
          </div>
        </div>
      </WorkspaceCard>
    </AnalysisPageFrame>
  );
}
