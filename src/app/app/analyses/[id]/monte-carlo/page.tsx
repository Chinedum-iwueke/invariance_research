import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { AnalysisRunState } from "@/components/dashboard/analysis-run-state";
import { DiagnosticFigure } from "@/components/dashboard/diagnostic-figure";
import { FigureCard } from "@/components/dashboard/figure-card";
import { InterpretationBlock } from "@/components/dashboard/interpretation-block";
import { MetricRow } from "@/components/dashboard/metric-row";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { figureTypes, logAnalysisPageDebug } from "@/lib/app/analysis-page-debug";
import { metricsFromScoreBands, selectMonteCarloTopMetrics, toInterpretationBlockPayload } from "@/lib/app/analysis-ui";
import { requireServerSession } from "@/lib/server/auth/session";
import { requireOwnedAnalysisView } from "@/lib/server/services/analysis-view-service";

export default async function MonteCarloPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const { id } = await params;
  const { analysis, record } = requireOwnedAnalysisView(id, session.account_id);

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
  const metrics = metricsFromScoreBands(selectedMetrics, {
    "P(Ruin)": "Unavailable values indicate the engine did not emit a ruin estimate for this run.",
    "Probability of Ruin": "Unavailable values indicate the engine did not emit a ruin estimate for this run.",
    "Risk-of-Ruin Probability": "Unavailable values indicate the engine did not emit a ruin estimate for this run.",
  });
  const hasRuinMetric = selectedMetrics.some((metric) => metric.label.toLowerCase().includes("ruin") && metric.value.toLowerCase() !== "unavailable");

  const riskBand = (() => {
    const critical = selectedMetrics.some((metric) => metric.band === "critical");
    const elevated = selectedMetrics.some((metric) => metric.band === "elevated");
    if (critical) return "Extreme";
    if (elevated) return "High";
    if (selectedMetrics.some((metric) => metric.band === "moderate")) return "Moderate";
    return "Low";
  })();

  const emittedWarnings = record.diagnostics.monte_carlo.warnings.map((warning) => warning.message);
  const monteCarloWarnings = [
    ...(monteCarlo.limitations ?? []),
    ...emittedWarnings.filter((message) => /monte|simulation|bootstrap|iid|serial|regime|liquidity|ruin/i.test(message)),
  ].filter((warning, idx, arr) => warning.trim().length > 0 && arr.indexOf(warning) === idx);

  const assumptions = monteCarlo.assumptions ?? [];
  const limitations = monteCarlo.limitations ?? [];
  const recommendations = monteCarlo.recommendations ?? [];

  return (
    <AnalysisPageFrame title="Monte Carlo Crash Test" description="Path-perturbation simulation evaluating drawdown severity and survivability under adverse sequencing.">
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
        <WorkspaceCard title="Advanced scope not yet included" subtitle="Methodological boundaries">
          <ul className="space-y-1.5 text-sm text-text-neutral">
            <li>• No regime-conditioned sequencing.</li>
            <li>• No volatility clustering process model.</li>
            <li>• No liquidity/execution crash amplification.</li>
            <li>• No serial-dependence (block bootstrap) model.</li>
          </ul>
        </WorkspaceCard>
      </div>

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
        note={primaryFigure.note}
      />
      {secondaryFigures.length ? (
        <div className="grid gap-5 2xl:grid-cols-2">
          {secondaryFigures.map((figure) => (
            <FigureCard
              key={figure.figure_id}
              title={figure.title}
              subtitle={figure.subtitle}
              figure={<DiagnosticFigure figure={figure} height={figure.type === "histogram" ? 520 : 500} />}
              note={figure.note}
            />
          ))}
        </div>
      ) : null}

      <MetricRow metrics={metrics} cols={4} />

      <div className="grid gap-5 2xl:grid-cols-[1.25fr_0.95fr]">
        <InterpretationBlock {...toInterpretationBlockPayload(record.diagnostics.monte_carlo.interpretation)} />
        <WorkspaceCard title="Warnings & limitations" subtitle="Material constraints on this crash test">
          {monteCarloWarnings.length === 0 ? (
            <p className="text-sm text-text-neutral">No Monte Carlo-specific warnings were emitted for this run.</p>
          ) : (
            <ul className="space-y-2 text-sm text-text-neutral">
              {monteCarloWarnings.map((warning, index) => (
                <li key={`warning-${index}-${warning.slice(0, 24)}`}>• {warning}</li>
              ))}
            </ul>
          )}
        </WorkspaceCard>
      </div>
      <WorkspaceCard title="Simulation assumptions, limitations & recommendations" subtitle="Engine-native methodology and guidance">
        <div className="grid gap-4 text-sm text-text-neutral md:grid-cols-3">
          <div>
            <p className="font-medium text-text-graphite">Assumptions</p>
            {assumptions.length === 0 ? <p className="mt-1 text-xs text-text-neutral">No assumptions were explicitly emitted.</p> : <ul className="mt-1 space-y-1">{assumptions.map((item, index) => <li key={`assumption-${index}-${item.slice(0, 24)}`}>• {item}</li>)}</ul>}
          </div>
          <div>
            <p className="font-medium text-text-graphite">Limitations</p>
            {limitations.length === 0 ? <p className="mt-1 text-xs text-text-neutral">No additional limitations were emitted.</p> : <ul className="mt-1 space-y-1">{limitations.map((item, index) => <li key={`limitation-${index}-${item.slice(0, 24)}`}>• {item}</li>)}</ul>}
          </div>
          <div>
            <p className="font-medium text-text-graphite">Recommendations</p>
            {recommendations.length === 0 ? <p className="mt-1 text-xs text-text-neutral">No recommendations were emitted.</p> : <ul className="mt-1 space-y-1">{recommendations.map((item, index) => <li key={`recommendation-${index}-${item.slice(0, 24)}`}>• {item}</li>)}</ul>}
          </div>
        </div>
      </WorkspaceCard>
    </AnalysisPageFrame>
  );
}
