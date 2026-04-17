import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { AnalysisRunState } from "@/components/dashboard/analysis-run-state";
import { DiagnosticFigure } from "@/components/dashboard/diagnostic-figure";
import { FigureCard } from "@/components/dashboard/figure-card";
import { MetricRow } from "@/components/dashboard/metric-row";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { ContextFlipCard } from "@/components/dashboard/context-flip-card";
import { figureTypes, logAnalysisPageDebug } from "@/lib/app/analysis-page-debug";
import { metricsFromScoreBands, selectDistributionTopMetrics } from "@/lib/app/analysis-ui";
import { buildTruthContext } from "@/lib/app/context-truth";
import { requireServerSession } from "@/lib/server/auth/session";
import { requireOwnedAnalysisView } from "@/lib/server/services/analysis-view-service";

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function isUnavailable(value: string): boolean {
  return ["", "unavailable", "n/a", "na", "unknown", "not available", "-"].includes(normalizeText(value));
}

function toBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

export default async function DistributionPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const { id } = await params;
  const { analysis, record } = requireOwnedAnalysisView(id, session.account_id);

  if (!record) {
    return (
      <AnalysisPageFrame title="Trade Distribution" description="Statistical structure of trade outcomes beyond aggregate PnL.">
        <AnalysisRunState analysis={analysis} />
      </AnalysisPageFrame>
    );
  }

  const distribution = record.diagnostics.distribution;
  const metrics = selectDistributionTopMetrics(record.diagnostics.distribution.metrics, 4);
  const availableMetrics = metrics.filter((metric) => !isUnavailable(metric.value));
  const renderedMetrics = availableMetrics.length >= 3 ? availableMetrics : metrics;

  const figures = distribution.figures;
  const fallbackDistributionFigure = distribution.figure;
  const selectedFigures = figures.length ? figures : (fallbackDistributionFigure ? [fallbackDistributionFigure] : []);
  const distributionBranch = figures.length
    ? "native_figures_branch"
    : fallbackDistributionFigure
      ? (fallbackDistributionFigure.provenance === "reconstructed_from_trades" || fallbackDistributionFigure.provenance === "synthesized_fallback"
          ? "fallback_reconstructed_branch"
          : "singular_figure_branch")
      : "empty_state_branch";
  const distributionEmptyReason = distributionBranch === "empty_state_branch"
    ? "no figures on record (diagnostics.distribution.figures empty and diagnostics.distribution.figure missing)"
    : undefined;
  logAnalysisPageDebug({
    analysis_id: record.analysis_id,
    page: "distribution",
    input_figure_count: figures.length,
    input_figure_types: figureTypes(figures),
    singular_figure_present: Boolean(fallbackDistributionFigure),
    fallback_figure_source_available: Boolean(fallbackDistributionFigure) || figures.some((figure) => figure.provenance === "reconstructed_from_trades" || figure.provenance === "synthesized_fallback"),
    selected_figure_count: selectedFigures.length,
    selected_figure_types: figureTypes(selectedFigures),
    branch: distributionBranch,
    empty_state_reason: distributionEmptyReason,
  });
  const histogram = figures.find((figure) => figure.type === "histogram");
  const engineHistogramProvenance = typeof distribution.metadata?.histogram_provenance === "string"
    ? distribution.metadata.histogram_provenance
    : (histogram?.provenance === "synthesized_fallback" ? "derived_from_persisted_trades" : "engine_emitted");
  const hasExcursion = toBoolean(distribution.metadata?.has_excursion) ?? figures.some((figure) => figure.title.toLowerCase().includes("mae") || figure.title.toLowerCase().includes("mfe"));
  const hasDuration = toBoolean(distribution.metadata?.has_duration) ?? distribution.metrics.some((metric) => metric.label.toLowerCase().includes("duration") && !isUnavailable(metric.value));

  const truthContext = buildTruthContext(record, "distribution");
  const keyShapeFindings = Array.from(new Set([
    ...(distribution.interpretation.bullets ?? []),
    ...record.summary.key_findings.filter((item) => /win|loss|tail|skew|expectancy|distribution|payoff/i.test(item)),
  ])).slice(0, 5);

  return (
    <AnalysisPageFrame title="Trade Distribution" description="Statistical structure of trade outcomes beyond aggregate PnL.">
      <div className="flex flex-wrap gap-2">
        {[
          { label: "Trade count", value: String(record.dataset.trade_count) },
          { label: "Coverage", value: `${record.dataset.start_date ?? "N/A"} → ${record.dataset.end_date ?? "N/A"}` },
          { label: "Figures", value: `${figures.length} persisted` },
          { label: "Returns", value: histogram ? "available" : "unavailable" },
          { label: "MAE/MFE", value: hasExcursion ? "available" : "unavailable" },
          { label: "Duration", value: hasDuration ? "available" : "unavailable" },
        ].map((item, index) => (
          <div key={`${item.label}-${index}`} className="rounded-full border border-border-subtle bg-surface-panel px-3 py-1 text-xs text-text-neutral">
            <span className="font-medium text-text-graphite">{item.label}:</span> {item.value}
          </div>
        ))}
      </div>

      <MetricRow metrics={metricsFromScoreBands(renderedMetrics)} cols={4} />

      <div className="space-y-4">
        {figures.length ? (
          <div className="space-y-5">
            {figures.map((figure) => (
              <FigureCard
                key={figure.figure_id}
                title={figure.title}
                subtitle={figure.subtitle}
                figure={<DiagnosticFigure figure={figure} />}
                metadata={figure.figure_id === histogram?.figure_id
                  ? <span className="rounded-full border border-border-subtle px-2 py-0.5">{engineHistogramProvenance === "engine_emitted" ? "Engine-native histogram" : "Reconstructed from persisted trades"}</span>
                  : undefined}
              />
            ))}
          </div>
        ) : <DiagnosticFigure figure={undefined} emptyMessage="No persisted distribution figures are currently available for this run." />}
      </div>

      <WorkspaceCard title="Distribution shape insights" subtitle="How outcomes cluster and where asymmetry appears in this run.">
        {keyShapeFindings.length ? (
          <ul className="space-y-1.5 text-sm text-text-neutral">
            {keyShapeFindings.map((item, index) => <li key={`shape-${index}-${item.slice(0, 24)}`}>• {item}</li>)}
          </ul>
        ) : (
          <p className="text-sm text-text-neutral">No shape-specific interpretation was emitted for this run. Upload richer trade annotations to unlock stronger tail and asymmetry commentary.</p>
        )}
      </WorkspaceCard>

      <WorkspaceCard title="Trade-level summary" subtitle="Exact distribution evidence available in the persisted run payload.">
        <ul className="space-y-2 text-sm text-text-neutral">
          <li>• Trade count: <span className="font-medium text-text-graphite">{record.dataset.trade_count}</span></li>
          <li>• Coverage window: <span className="font-medium text-text-graphite">{record.dataset.start_date ?? "N/A"} → {record.dataset.end_date ?? "N/A"}</span></li>
          <li>• Key findings available: <span className="font-medium text-text-graphite">{record.summary.key_findings.length}</span></li>
          <li>• Histogram source: <span className="font-medium text-text-graphite">{engineHistogramProvenance === "engine_emitted" ? "Engine-native" : "Derived fallback from persisted trade PnL"}</span></li>
          <li>• Excursion fields (MAE/MFE): <span className="font-medium text-text-graphite">{hasExcursion ? "Present" : "Not present"}</span></li>
          <li>• Duration statistics: <span className="font-medium text-text-graphite">{hasDuration ? "Present" : "Not present"}</span></li>
        </ul>
      </WorkspaceCard>

      <ContextFlipCard
        title="Distribution context"
        subtitle="Truth-based assumptions, limitations, and recommendations for this exact run."
        panes={[
          { key: "assumptions", label: "Assumptions", items: truthContext.assumptions, empty: "No explicit assumptions were emitted for this run.", tone: "neutral" },
          { key: "limitations", label: "Limitations", items: truthContext.limitations, empty: "No explicit limitations were emitted for this run.", tone: "warning" },
          { key: "recommendations", label: "Recommendations", items: truthContext.recommendations, empty: "No explicit recommendations were emitted for this run.", tone: "positive" },
        ]}
      />

    </AnalysisPageFrame>
  );
}
