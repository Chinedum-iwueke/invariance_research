import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { AnalysisRunState } from "@/components/dashboard/analysis-run-state";
import { AnalystWorkbenchPanel } from "@/components/dashboard/analyst-workbench";
import { DiagnosticFigure } from "@/components/dashboard/diagnostic-figure";
import { FigureCard } from "@/components/dashboard/figure-card";
import { MetricRow } from "@/components/dashboard/metric-row";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { ContextFlipCard } from "@/components/dashboard/context-flip-card";
import { AiSynthesisPanel } from "@/components/dashboard/ai-synthesis-panel";
import { EvidenceList } from "@/components/dashboard/evidence-list";
import { figureTypes, logAnalysisPageDebug } from "@/lib/app/analysis-page-debug";
import { buildAnalystWorkbenchModel } from "@/lib/app/analyst-workbench";
import { metricsFromScoreBands, selectMonteCarloTopMetrics } from "@/lib/app/analysis-ui";
import { buildTruthContext } from "@/lib/app/context-truth";
import { requireServerSession } from "@/lib/server/auth/session";
import { requireOwnedAnalysisView } from "@/lib/server/services/analysis-view-service";
import { pageInsightRecommendations } from "@/lib/server/llm-insights";

function findMetric(metrics: Array<{ label: string; value: string }>, patterns: RegExp[]) {
  return metrics.find((metric) => patterns.some((pattern) => pattern.test(metric.label)));
}

function metricValue(metrics: Array<{ label: string; value: string }>, patterns: RegExp[], fallback = "Not emitted") {
  return findMetric(metrics, patterns)?.value ?? fallback;
}

function parsePercent(value: string | undefined) {
  if (!value) return undefined;
  const match = value.match(/-?\d+(?:\.\d+)?/);
  if (!match) return undefined;
  return Number(match[0]);
}

export default async function MonteCarloPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const { id } = await params;
  const { analysis, record } = await requireOwnedAnalysisView(id, session.account_id);

  if (!record) {
    return (
      <AnalysisPageFrame title="Monte Carlo Crash Test" description="Path-perturbation simulation evaluating drawdown severity and survivability under adverse sequencing.">
        <AnalysisRunState analysis={analysis} />
      </AnalysisPageFrame>
    );
  }

  const monteCarlo = record.diagnostics.monte_carlo;
  const monteCarloFigures = monteCarlo.figures ?? [];
  const primaryFigure = monteCarloFigures.find((figure) => figure.figure_id === "equity_fan_chart")
    ?? monteCarloFigures.find((figure) => figure.type === "fan_chart" || figure.type === "fan")
    ?? monteCarlo.figure;
  const secondaryFigures = monteCarloFigures.filter((figure) => figure.figure_id !== primaryFigure.figure_id);
  const selectedFigures = primaryFigure ? [primaryFigure, ...secondaryFigures] : secondaryFigures;
  const monteCarloBranch = monteCarloFigures.length > 0
    ? "native_figures_branch"
    : primaryFigure
      ? (primaryFigure.provenance === "reconstructed_from_trades" || primaryFigure.provenance === "synthesized_fallback"
          ? "fallback_reconstructed_branch"
          : "singular_figure_branch")
      : "empty_state_branch";
  const monteCarloEmptyReason = monteCarloBranch === "empty_state_branch"
    ? "no figures on record (diagnostics.monte_carlo.figures empty and diagnostics.monte_carlo.figure missing)"
    : undefined;
  logAnalysisPageDebug({
    analysis_id: record.analysis_id,
    page: "monte_carlo",
    input_figure_count: monteCarloFigures.length,
    input_figure_types: figureTypes(monteCarloFigures),
    singular_figure_present: Boolean(monteCarlo.figure),
    fallback_figure_source_available: Boolean(monteCarlo.figure) || monteCarloFigures.some((figure) => figure.provenance === "reconstructed_from_trades" || figure.provenance === "synthesized_fallback"),
    selected_figure_count: selectedFigures.length,
    selected_figure_types: figureTypes(selectedFigures),
    branch: monteCarloBranch,
    empty_state_reason: monteCarloEmptyReason,
  });
  const metadata = monteCarlo.metadata ?? {};
  const method = typeof metadata.method === "string" ? metadata.method : "Bootstrap IID";
  const horizon = typeof metadata.horizon === "string" ? metadata.horizon : typeof metadata.horizon_days === "number" ? `${metadata.horizon_days} trading days` : "Not emitted";
  const simulations = typeof metadata.simulations === "number"
    ? metadata.simulations.toLocaleString()
    : typeof metadata.paths === "number"
      ? metadata.paths.toLocaleString()
      : typeof metadata.n_paths === "number"
        ? metadata.n_paths.toLocaleString()
        : "Not emitted";
  const ruinThreshold = typeof metadata.ruin_threshold_pct === "number"
    ? `${metadata.ruin_threshold_pct.toFixed(1)}%`
    : typeof metadata.ruin_threshold === "string"
      ? metadata.ruin_threshold
      : "Not emitted";

  const selectedMetrics = selectMonteCarloTopMetrics(record.diagnostics.monte_carlo.metrics, 4);
  const allMonteCarloMetrics = record.diagnostics.monte_carlo.metrics;
  const hasRuinMetric = selectedMetrics.some((metric) => metric.label.toLowerCase().includes("ruin") && metric.value.toLowerCase() !== "unavailable");
  const ruinValue = metricValue(allMonteCarloMetrics, [/ruin/i, /breach probability/i], hasRuinMetric ? "See emitted metric" : "Not emitted");
  const p95DrawdownValue = metricValue(allMonteCarloMetrics, [/95.*drawdown/i, /p95.*drawdown/i, /drawdown.*95/i], "Not emitted");
  const worstDrawdownValue = metricValue(allMonteCarloMetrics, [/worst.*drawdown/i, /max.*drawdown/i], "Not emitted");
  const terminalValue = metricValue(allMonteCarloMetrics, [/terminal/i, /ending/i, /final/i], "Not emitted");
  const metrics = metricsFromScoreBands(selectedMetrics, {
    "P(Ruin)": "Unavailable values indicate the engine did not emit a ruin estimate for this run.",
    "Probability of Ruin": "Unavailable values indicate the engine did not emit a ruin estimate for this run.",
    "Risk-of-Ruin Probability": "Unavailable values indicate the engine did not emit a ruin estimate for this run.",
  });
  const riskBand = (() => {
    const critical = selectedMetrics.some((metric) => metric.band === "critical");
    const elevated = selectedMetrics.some((metric) => metric.band === "elevated");
    if (critical) return "Extreme";
    if (elevated) return "High";
    if (selectedMetrics.some((metric) => metric.band === "moderate")) return "Moderate";
    return "Low";
  })();
  const p95DrawdownPct = parsePercent(p95DrawdownValue);
  const worstDrawdownPct = parsePercent(worstDrawdownValue);
  const decisionPosture = selectedMetrics.some((metric) => metric.band === "critical")
    ? "Do not size up from this evidence."
    : selectedMetrics.some((metric) => metric.band === "elevated") || (p95DrawdownPct !== undefined && Math.abs(p95DrawdownPct) >= 25)
      ? "Treat as capital-constrained until sizing is reduced."
      : "Survivability is not the blocking issue in the emitted simulation.";

  const truthContext = buildTruthContext(record, "monte_carlo", { benchmark: analysis.benchmark });
  const monteCarloRecommendations = pageInsightRecommendations(record, "monte_carlo", truthContext.recommendations);
  const workbench = buildAnalystWorkbenchModel(record, "monte_carlo", { benchmark: analysis.benchmark });

  return (
    <AnalysisPageFrame title="Monte Carlo Crash Test" description="Path-perturbation simulation evaluating drawdown severity and survivability under adverse sequencing.">
      <AnalystWorkbenchPanel model={workbench} />

      <div className="grid gap-4 md:grid-cols-3">
        <WorkspaceCard title="Risk classification" subtitle="Crash-test status framing">
          <div className="grid gap-3 text-sm text-text-neutral">
            <p><span className="font-medium text-text-graphite">Tail risk:</span> {riskBand}</p>
            <p><span className="font-medium text-text-graphite">Ruin signal:</span> {hasRuinMetric ? "Available" : "Unavailable in emitted metrics"}</p>
            <p><span className="font-medium text-text-graphite">MC method:</span> {method}</p>
          </div>
        </WorkspaceCard>
        <WorkspaceCard title="Simulation run metadata" subtitle="What was actually simulated">
          <div className="grid gap-3 text-sm text-text-neutral">
            <p><span className="font-medium text-text-graphite">Simulation paths:</span> {simulations}</p>
            <p><span className="font-medium text-text-graphite">Horizon:</span> {horizon}</p>
            <p><span className="font-medium text-text-graphite">Ruin threshold:</span> {ruinThreshold}</p>
          </div>
        </WorkspaceCard>
        <WorkspaceCard title="Simulation realism posture" subtitle="What was materially available in this run context">
          <EvidenceList
            items={[
              `Method: ${method}`,
              `Paths: ${simulations}`,
              `Horizon: ${horizon}`,
              `Ruin threshold: ${ruinThreshold}`,
            ]}
            empty="No simulation realism fields were emitted."
          />
        </WorkspaceCard>
      </div>

      <WorkspaceCard title="Decision-maker crash answer" subtitle="What the simulation says about capital survival, tail loss, and deployment sizing.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-md border border-border-subtle bg-surface-subtle p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-neutral">Deployment answer</p>
            <p className="mt-2 text-sm font-semibold text-text-institutional">{decisionPosture}</p>
          </div>
          <div className="rounded-md border border-border-subtle bg-surface-subtle p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-neutral">Tail drawdown</p>
            <p className="mt-2 text-2xl font-semibold text-text-institutional">{p95DrawdownValue}</p>
            <p className="mt-1 text-xs leading-5 text-text-neutral">Decision makers should size against this, not against average-path comfort.</p>
          </div>
          <div className="rounded-md border border-border-subtle bg-surface-subtle p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-neutral">Worst simulated path</p>
            <p className="mt-2 text-2xl font-semibold text-text-institutional">{worstDrawdownValue}</p>
            <p className="mt-1 text-xs leading-5 text-text-neutral">Use this as a stop-deployment boundary unless the method is too limited.</p>
          </div>
          <div className="rounded-md border border-border-subtle bg-surface-subtle p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-neutral">Ruin / breach risk</p>
            <p className="mt-2 text-2xl font-semibold text-text-institutional">{ruinValue}</p>
            <p className="mt-1 text-xs leading-5 text-text-neutral">If absent, the report cannot make a full survival claim.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
          <div className="rounded-md border border-border-subtle bg-surface-white p-4">
            <p className="text-sm font-semibold text-text-institutional">What this should answer</p>
            <EvidenceList
              items={[
                "How bad can sequencing get if the same trade distribution arrives in a worse order?",
                "What drawdown should capital planning survive at the 95th percentile or worse?",
                "Whether the strategy still survives after risk sizing, losses, and path clustering are stressed.",
                "Which limitation prevents the simulation from being treated as a deployment-grade survival test.",
              ]}
              empty="No crash-test questions were emitted."
            />
          </div>
          <div className="rounded-md border border-border-subtle bg-surface-white p-4">
            <p className="text-sm font-semibold text-text-institutional">Information quality check</p>
            <EvidenceList
              items={[
                `Simulation paths: ${simulations}`,
                `Horizon: ${horizon}`,
                `Method: ${method}`,
                `Terminal wealth signal: ${terminalValue}`,
                worstDrawdownPct === undefined ? "Worst-path drawdown was not emitted as a numeric percent." : `Worst-path drawdown parsed as approximately ${Math.abs(worstDrawdownPct).toFixed(1)}%.`,
              ]}
              empty="No simulation quality checks were emitted."
            />
          </div>
        </div>
      </WorkspaceCard>

      <FigureCard
        title={primaryFigure.title || "Monte Carlo Fan Chart — Simulated Equity Path Dispersion"}
        subtitle={primaryFigure.subtitle || "Percentile envelopes summarize how severe simulated equity drawdowns can become under sequence perturbation."}
        figure={(
          <DiagnosticFigure
            figure={primaryFigure}
            emptyMessage="No persisted Monte Carlo fan chart is currently available for this run."
            height={620}
          />
        )}
      />
      {secondaryFigures.length ? (
        <div className="space-y-5">
          {secondaryFigures.map((figure) => (
            <FigureCard
              key={figure.figure_id}
              title={figure.title}
              subtitle={figure.subtitle}
              figure={<DiagnosticFigure figure={figure} height={figure.type === "histogram" ? 520 : 500} />}
            />
          ))}
        </div>
      ) : null}

      <MetricRow metrics={metrics} cols={4} />

      {record.llm_insights?.monte_carlo_interpretation ? (
        <AiSynthesisPanel
          title="Path-risk synthesis"
          summary={record.llm_insights.monte_carlo_interpretation}
          bullets={record.llm_insights.monte_carlo_interpretation_detail?.fragility_signals}
          model={record.llm_insights_model}
        />
      ) : null}

      <ContextFlipCard
        title="Simulation assumptions, limitations & recommendations"
        subtitle="Truth-based methodology and guidance for this run."
        panes={[
          { key: "assumptions", label: "Assumptions", items: truthContext.assumptions, empty: "No assumptions were explicitly emitted.", tone: "neutral" },
          { key: "limitations", label: "Limitations", items: truthContext.limitations, empty: "No additional limitations were emitted.", tone: "warning" },
          { key: "recommendations", label: "Recommendations", items: monteCarloRecommendations, empty: "No recommendations were emitted.", tone: "positive" },
        ]}
      />
    </AnalysisPageFrame>
  );
}
