import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { AnalysisRunState } from "@/components/dashboard/analysis-run-state";
import { DiagnosticFigure } from "@/components/dashboard/diagnostic-figure";
import { FigureCard } from "@/components/dashboard/figure-card";
import { MetricRow } from "@/components/dashboard/metric-row";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { ContextFlipCard } from "@/components/dashboard/context-flip-card";
import { AiSynthesisPanel } from "@/components/dashboard/ai-synthesis-panel";
import { EvidenceStatePanel, EvidenceStatusBadge, normalizeEvidenceState } from "@/components/dashboard/evidence-status";
import { OverviewBenchmarkSection } from "@/components/diagnostics/overview/OverviewBenchmarkSection";
import { figureTypes, logAnalysisPageDebug } from "@/lib/app/analysis-page-debug";
import { metricsFromScoreBands, selectOverviewTopMetrics } from "@/lib/app/analysis-ui";
import type { AnalysisRecord } from "@/lib/contracts";
import { mapOverviewBenchmarkPayload } from "@/lib/diagnostics/overview/map-benchmark-payload";
import { buildTruthContext } from "@/lib/app/context-truth";
import { requireServerSession } from "@/lib/server/auth/session";
import { requireOwnedAnalysisView } from "@/lib/server/services/analysis-view-service";
import { pageInsightRecommendations } from "@/lib/server/llm-insights";

function StatusPill({ label, value, tone = "neutral" }: { label?: string; value: string; tone?: "neutral" | "positive" | "warning" }) {
  const toneClass = tone === "positive"
    ? "border-chart-positive/20 bg-chart-positive/10 text-chart-positive"
    : tone === "warning"
      ? "border-amber-500/25 bg-amber-500/10 text-amber-700"
      : "border-border-subtle bg-surface-muted text-text-neutral";

  return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${toneClass}`}>{label ? `${label}: ` : ""}{value}</span>;
}

function toTitleCase(value: string): string {
  return value.split("_").map((token) => token.charAt(0).toUpperCase() + token.slice(1)).join(" ");
}

function benchmarkStatusLabel(status: string): string {
  if (status === "available") return "Present";
  if (status === "unavailable") return "Unavailable";
  if (status === "absent") return "Absent";
  return "Pending";
}

function diagnosticRows(record: AnalysisRecord) {
  const diagnostics = ["overview", "distribution", "monte_carlo", "execution", "stability", "regimes", "ruin", "report"] as const;
  return diagnostics.map((name) => ({
    name,
    status: record.diagnostic_statuses[name]?.status ?? "unavailable",
  }));
}

export default async function OverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const { id } = await params;
  const { analysis, record } = await requireOwnedAnalysisView(id, session.account_id);

  if (!record) {
    return (
      <AnalysisPageFrame title="Overview" description="Immediate robustness and risk posture for this strategy under execution-aware validation.">
        <AnalysisRunState analysis={analysis} />
      </AnalysisPageFrame>
    );
  }

  const overviewEnvelope = record.engine_payload.diagnostics.overview;
  const persistedOverviewFigures = record.diagnostics.overview.figures ?? [];
  const overviewFigure = persistedOverviewFigures.find((figure) => figure.figure_id === "equity_curve")
    ?? persistedOverviewFigures.find((figure) => figure.series.length > 0)
    ?? persistedOverviewFigures[0]
    ?? record.diagnostics.overview.figure;
  const figureMetadata = overviewEnvelope?.metadata && typeof overviewEnvelope.metadata === "object" ? overviewEnvelope.metadata as Record<string, unknown> : undefined;
  const provenance = typeof figureMetadata?.overview_figure_provenance === "string" ? figureMetadata.overview_figure_provenance : "unknown";
  const artifactRichness = typeof figureMetadata?.artifact_richness === "string" ? figureMetadata.artifact_richness : analysis.eligibility_snapshot?.detected_richness ?? "unknown";
  const benchmarkStatus = typeof figureMetadata?.benchmark_status === "string" ? figureMetadata.benchmark_status : "pending";
  const executionContextLevel = typeof figureMetadata?.execution_context_level === "string" ? figureMetadata.execution_context_level : record.engine_payload.diagnostics.execution?.status ?? "limited";
  const completeness = diagnosticRows(record).filter((row) => row.status === "available").length;

  const selectedMetrics = selectOverviewTopMetrics(record.diagnostics.overview.metrics, 6);
  const overviewFigures = record.diagnostics.overview.figures?.length
    ? record.diagnostics.overview.figures
    : [record.diagnostics.overview.figure];
  const overviewInputFigureTypes = figureTypes(persistedOverviewFigures);
  const overviewSelectedFigureTypes = figureTypes(overviewFigures);
  const overviewBranch = persistedOverviewFigures.length > 0
    ? "native_figures_branch"
    : record.diagnostics.overview.figure
      ? "singular_figure_branch"
      : "empty_state_branch";
  const overviewEmptyReason = overviewBranch === "empty_state_branch"
    ? "no figures on record (both diagnostics.overview.figures and diagnostics.overview.figure are missing)"
    : undefined;
  logAnalysisPageDebug({
    analysis_id: record.analysis_id,
    page: "overview",
    input_figure_count: persistedOverviewFigures.length,
    input_figure_types: overviewInputFigureTypes,
    singular_figure_present: Boolean(record.diagnostics.overview.figure),
    fallback_figure_source_available: provenance === "reconstructed_from_trades" || persistedOverviewFigures.some((figure) => figure.provenance === "reconstructed_from_trades" || figure.provenance === "synthesized_fallback"),
    selected_figure_count: overviewFigures.length,
    selected_figure_types: overviewSelectedFigureTypes,
    branch: overviewBranch,
    empty_state_reason: overviewEmptyReason,
  });
  const truthContext = buildTruthContext(record, "overview", { benchmark: analysis.benchmark });
  const overviewRecommendations = pageInsightRecommendations(record, "overview", truthContext.recommendations);
  const benchmarkComparison = mapOverviewBenchmarkPayload(overviewEnvelope);

  return (
    <AnalysisPageFrame title="Overview" description="Case-file cover sheet for this strategy: verdict, evidence coverage, diagnostic support, and the next experiment.">
      <section className="grid gap-5 rounded-md border border-border-subtle bg-surface-paper p-card-lg shadow-soft xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          <p className="eyebrow text-brand">Analysis case file</p>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-[clamp(2.25rem,5vw,4rem)] leading-none tracking-normal text-text-institutional">{record.strategy.strategy_name}</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-text-neutral">{record.summary.headline_verdict.summary}</p>
            </div>
            <EvidenceStatusBadge state={normalizeEvidenceState(record.summary.headline_verdict.status)} label={toTitleCase(record.summary.headline_verdict.status)} />
          </div>
          <div className="grid gap-3 border-t border-border-subtle pt-4 text-sm text-text-neutral md:grid-cols-3">
            <p><span className="font-medium text-text-graphite">Artifact:</span> {toTitleCase(artifactRichness)}</p>
            <p><span className="font-medium text-text-graphite">Evidence coverage:</span> {completeness}/8 diagnostics</p>
            <p><span className="font-medium text-text-graphite">Generated:</span> {record.report.generated_at ?? record.updated_at}</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
          <EvidenceStatePanel state={completeness >= 5 ? "supported" : "limited"} title="Strongest support" body={record.diagnostics.overview.interpretation.summary} reasonCode="overview.verdict" />
          <EvidenceStatePanel state={executionContextLevel === "available" ? "supported" : "limited"} title="Strongest doubt" body={`Execution context is ${toTitleCase(executionContextLevel)} for this artifact.`} reasonCode="execution.context" />
          <EvidenceStatePanel state={benchmarkStatus === "available" ? "supported" : "unsupported"} title="Next experiment" body={benchmarkStatus === "available" ? "Review benchmark-relative evidence and report limitations." : "Add benchmark or market-context data before relying on relative-performance claims."} reasonCode="next.experiment" />
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <StatusPill label="Artifact" value={toTitleCase(artifactRichness)} tone="neutral" />
        <StatusPill label="Benchmark" value={benchmarkStatusLabel(benchmarkStatus)} tone={benchmarkStatus === "available" ? "positive" : "warning"} />
        <StatusPill label="Execution context" value={toTitleCase(executionContextLevel)} tone={executionContextLevel === "available" ? "positive" : "warning"} />
        <StatusPill label="Diagnostics" value={`${completeness}/8 available`} tone={completeness >= 5 ? "positive" : "warning"} />
      </div>

      <FigureCard
        title={overviewFigure.title || "Top-line equity view"}
        subtitle={overviewFigure.subtitle || "Primary strategy equity path for initial decisioning"}
        figure={<DiagnosticFigure figure={overviewFigure} emptyMessage="No persisted overview figure is currently available for this run." />}
        metadata={(
          <>
            <StatusPill label="Provenance" value={provenance === "engine_emitted" ? "Engine-emitted" : provenance === "reconstructed_from_trades" ? "Reconstructed from trades" : "Unknown"} tone={provenance === "engine_emitted" ? "positive" : "warning"} />
            <StatusPill label="Artifact richness" value={toTitleCase(artifactRichness)} />
            <StatusPill label="Benchmark" value={benchmarkStatusLabel(benchmarkStatus)} tone={benchmarkStatus === "available" ? "positive" : "warning"} />
            <StatusPill label="Execution context" value={toTitleCase(executionContextLevel)} tone={executionContextLevel === "available" ? "positive" : "warning"} />
          </>
        )}
      />
      {overviewFigures.length > 1 ? (
        <div className="space-y-5">
          {overviewFigures.slice(1).map((figure) => (
            <FigureCard
              key={figure.figure_id}
              title={figure.title}
              subtitle={figure.subtitle}
              figure={<DiagnosticFigure figure={figure} />}
            />
          ))}
        </div>
      ) : null}

      <MetricRow metrics={metricsFromScoreBands(selectedMetrics)} cols={6} />
      <OverviewBenchmarkSection benchmark={benchmarkComparison} />
      <AiSynthesisPanel
        title="Overview synthesis"
        summary={record.llm_insights?.overview_interpretation}
        bullets={record.llm_insights?.validation_verdict?.strengths}
        model={record.llm_insights_model}
      />

      <WorkspaceCard title="Operational summary" subtitle="What exactly was analyzed in this run">
        <div className="grid gap-3 text-sm text-text-neutral md:grid-cols-2">
          <p><span className="font-medium text-text-graphite">Trade count:</span> {record.dataset.trade_count}</p>
          <p><span className="font-medium text-text-graphite">Date window:</span> {record.dataset.start_date ?? "N/A"} → {record.dataset.end_date ?? "N/A"}</p>
          <p><span className="font-medium text-text-graphite">Asset/Symbols:</span> {record.strategy.symbols.length ? record.strategy.symbols.join(", ") : "N/A"}</p>
          <p><span className="font-medium text-text-graphite">Execution context level:</span> {toTitleCase(executionContextLevel)}</p>
          <p><span className="font-medium text-text-graphite">Artifact richness:</span> {toTitleCase(artifactRichness)}</p>
          <p><span className="font-medium text-text-graphite">Risk model:</span> {record.run_context.risk_model}</p>
          <p><span className="font-medium text-text-graphite">Parser/adapter:</span> {analysis.engine_context?.engine_name ?? "N/A"} / {analysis.engine_context?.seam ?? "N/A"}</p>
          <p><span className="font-medium text-text-graphite">Benchmark status:</span> {benchmarkStatusLabel(benchmarkStatus)}</p>
        </div>
      </WorkspaceCard>

      <WorkspaceCard title="Methodology posture" subtitle="Diagnostic availability for this artifact and runtime">
        <div className="grid gap-2 md:grid-cols-2">
          {diagnosticRows(record).map((row, index) => (
            <div key={`${row.name}-${index}`} className="flex items-center justify-between rounded-md border border-border-subtle bg-surface-muted px-3 py-2 text-sm">
              <span className="font-medium text-text-graphite">{toTitleCase(row.name)}</span>
              <EvidenceStatusBadge state={normalizeEvidenceState(row.status)} label={toTitleCase(row.status)} compact />
            </div>
          ))}
        </div>
      </WorkspaceCard>

      <ContextFlipCard
        title="Diagnostic context"
        subtitle="Truth-based assumptions, limitations, and recommendations for this exact run."
        panes={[
          { key: "assumptions", label: "Assumptions", items: truthContext.assumptions, empty: "No assumptions were emitted for this run.", tone: "neutral" },
          { key: "limitations", label: "Limitations", items: truthContext.limitations, empty: "No explicit limitations were emitted for this run.", tone: "warning" },
          { key: "recommendations", label: "Recommendations", items: overviewRecommendations, empty: "No recommendations were emitted for this run.", tone: "positive" },
        ]}
      />
    </AnalysisPageFrame>
  );
}
