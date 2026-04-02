import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { AnalysisRunState } from "@/components/dashboard/analysis-run-state";
import { DiagnosticFigure } from "@/components/dashboard/diagnostic-figure";
import { FigureCard } from "@/components/dashboard/figure-card";
import { InterpretationBlock } from "@/components/dashboard/interpretation-block";
import { MetricRow } from "@/components/dashboard/metric-row";
import { VerdictCard } from "@/components/dashboard/verdict-card";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { OverviewBenchmarkSection } from "@/components/diagnostics/overview/OverviewBenchmarkSection";
import { figureTypes, logAnalysisPageDebug } from "@/lib/app/analysis-page-debug";
import { metricsFromScoreBands, selectOverviewTopMetrics, toInterpretationBlockPayload } from "@/lib/app/analysis-ui";
import type { AnalysisRecord, InterpretationBlockPayload } from "@/lib/contracts";
import { mapOverviewBenchmarkPayload } from "@/lib/diagnostics/overview/map-benchmark-payload";
import { requireServerSession } from "@/lib/server/auth/session";
import { requireOwnedAnalysisView } from "@/lib/server/services/analysis-view-service";

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

function verdictRationale(record: AnalysisRecord): string[] {
  if (record.summary.key_findings.length) return record.summary.key_findings.slice(0, 4);
  return [record.diagnostics.overview.interpretation.summary];
}

function overviewInterpretation(interpretation: InterpretationBlockPayload) {
  return {
    ...toInterpretationBlockPayload({
      ...interpretation,
    }),
  };
}

function diagnosticRows(record: AnalysisRecord) {
  const diagnostics = ["overview", "distribution", "monte_carlo", "execution", "stability", "regimes", "ruin", "report"] as const;
  return diagnostics.map((name) => ({
    name,
    status: record.diagnostic_statuses[name]?.status ?? "unavailable",
  }));
}

function sectionList(items: string[] | undefined, emptyState: string) {
  if (!items?.length) {
    return <p className="mt-1 text-xs text-text-neutral">{emptyState}</p>;
  }

  return (
    <ul className="mt-1 space-y-1">
      {items.map((item, index) => <li key={`section-item-${index}-${item.slice(0, 24)}`}>• {item}</li>)}
    </ul>
  );
}

export default async function OverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const { id } = await params;
  const { analysis, record } = requireOwnedAnalysisView(id, session.account_id);

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
  const assumptions = record.diagnostics.overview.assumptions?.length ? record.diagnostics.overview.assumptions : record.report.methodology_assumptions;
  const limitations = record.diagnostics.overview.limitations?.length ? record.diagnostics.overview.limitations : record.report.limitations;
  const recommendations = record.diagnostics.overview.recommendations?.length ? record.diagnostics.overview.recommendations : record.report.recommendations;
  const benchmarkComparison = mapOverviewBenchmarkPayload(overviewEnvelope);

  const parserNotes = Array.from(new Set([
    ...(analysis.eligibility_snapshot?.parser_notes ?? []),
    ...(record.run_context.notes ?? "").split("|").map((item) => item.trim()).filter(Boolean),
  ]));

  const omittedDimensions = [
    benchmarkStatus !== "available" ? "No benchmark-relative comparison is included in this run." : undefined,
    record.diagnostic_statuses.stability.status !== "available" ? "No parameter-surface fragility assessment is available in this run context." : undefined,
    record.diagnostic_statuses.regimes.status !== "available" ? "No market-regime decomposition is available for this artifact." : undefined,
  ].filter((item): item is string => Boolean(item));

  return (
    <AnalysisPageFrame title="Overview" description="Immediate robustness and risk posture for this strategy under execution-aware validation.">
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
        note={overviewFigure.note}
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
        <div className="grid gap-4 xl:grid-cols-2">
          {overviewFigures.slice(1).map((figure) => (
            <FigureCard
              key={figure.figure_id}
              title={figure.title}
              subtitle={figure.subtitle}
              figure={<DiagnosticFigure figure={figure} />}
              note={figure.note}
            />
          ))}
        </div>
      ) : null}

      <MetricRow metrics={metricsFromScoreBands(selectedMetrics)} cols={6} />
      <OverviewBenchmarkSection benchmark={benchmarkComparison} />

      <div className="grid gap-5 2xl:grid-cols-[1.3fr_0.9fr]">
        <InterpretationBlock {...overviewInterpretation(record.diagnostics.overview.interpretation)} />
        <VerdictCard
          title={record.summary.headline_verdict.title}
          summary={record.summary.headline_verdict.summary}
          posture={record.summary.headline_verdict.status}
          confidence={record.report.confidence}
          rationale={verdictRationale(record)}
        />
      </div>

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
              <StatusPill
                label=""
                value={toTitleCase(row.status)}
                tone={row.status === "available" ? "positive" : row.status === "limited" ? "warning" : "neutral"}
              />
            </div>
          ))}
        </div>
        <div className="mt-4 border-t pt-3 text-sm text-text-neutral">
          <p className="font-medium text-text-graphite">Parser/runtime notes</p>
          {parserNotes.length ? (
            <ul className="mt-1 space-y-1">
              {parserNotes.slice(0, 6).map((note, index) => <li key={`parser-note-${index}-${note.slice(0, 32)}`}>• {note}</li>)}
            </ul>
          ) : (
            <p className="mt-1 text-xs">No additional parser/runtime notes were persisted for this run.</p>
          )}
        </div>
      </WorkspaceCard>

      <WorkspaceCard title="Diagnostic context" subtitle="Engine-native assumptions, limitations, and recommendations">
        <div className="grid gap-4 text-sm text-text-neutral md:grid-cols-3">
          <div>
            <p className="font-medium text-text-graphite">Assumptions</p>
            {sectionList(assumptions, "No assumptions were emitted for this run.")}
          </div>
          <div>
            <p className="font-medium text-text-graphite">Limitations</p>
            {sectionList(limitations, "No explicit limitations were emitted for this run.")}
          </div>
          <div>
            <p className="font-medium text-text-graphite">Recommendations</p>
            {sectionList(recommendations, "No recommendations were emitted for this run.")}
          </div>
        </div>
      </WorkspaceCard>

      <WorkspaceCard title="What this page does not yet include" subtitle="Scope boundaries for this current run context">
        <ul className="space-y-1 text-sm text-text-neutral">
          {omittedDimensions.length
            ? omittedDimensions.map((item, index) => <li key={`omitted-${index}-${item.slice(0, 24)}`}>• {item}</li>)
            : <li>• This overview reflects the currently available diagnostics for this run.</li>}
        </ul>
      </WorkspaceCard>
    </AnalysisPageFrame>
  );
}
