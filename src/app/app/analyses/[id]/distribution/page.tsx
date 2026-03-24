import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { AnalysisRunState } from "@/components/dashboard/analysis-run-state";
import { DiagnosticFigure } from "@/components/dashboard/diagnostic-figure";
import { FigureCard } from "@/components/dashboard/figure-card";
import { InterpretationBlock } from "@/components/dashboard/interpretation-block";
import { MetricRow } from "@/components/dashboard/metric-row";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import type { FigurePayload } from "@/lib/contracts";
import { metricsFromScoreBands, selectDistributionTopMetrics, toInterpretationBlockPayload } from "@/lib/app/analysis-ui";
import { requireServerSession } from "@/lib/server/auth/session";
import { requireOwnedAnalysisView } from "@/lib/server/services/analysis-view-service";

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function hasData(figure: FigurePayload): boolean {
  return figure.series.some((series) => series.points.length > 0);
}

function isUnavailable(value: string): boolean {
  return ["", "unavailable", "n/a", "na", "unknown", "not available", "-"].includes(normalizeText(value));
}

function toBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  return undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function isHistogramFigure(figure: FigurePayload): boolean {
  const label = `${figure.title} ${figure.subtitle ?? ""} ${figure.note ?? ""}`.toLowerCase();
  return figure.type === "histogram" || label.includes("histogram") || label.includes("distribution");
}

function isWinLossFigure(figure: FigurePayload): boolean {
  const text = `${figure.title} ${figure.subtitle ?? ""} ${figure.note ?? ""} ${figure.series.map((series) => series.label).join(" ")}`.toLowerCase();
  return text.includes("win/loss") || text.includes("win loss") || text.includes("wins") || text.includes("losses");
}

function isSecondaryFigure(figure: FigurePayload): boolean {
  const text = `${figure.title} ${figure.subtitle ?? ""} ${figure.note ?? ""}`.toLowerCase();
  return figure.type === "scatter" || text.includes("mae") || text.includes("mfe") || text.includes("duration");
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
  const histogram = figures.find((figure) => isHistogramFigure(figure));
  const winLoss = figures.find((figure) => isWinLossFigure(figure) && figure.figure_id !== histogram?.figure_id);
  const remainingFigures = figures.filter((figure) => ![histogram?.figure_id, winLoss?.figure_id].includes(figure.figure_id));
  const secondaryAvailable = remainingFigures.filter((figure) => isSecondaryFigure(figure) && hasData(figure));
  const additionalAvailable = remainingFigures.filter((figure) => !isSecondaryFigure(figure) && hasData(figure));
  const unavailableDiagnostics = remainingFigures.filter((figure) => !hasData(figure));

  const primaryFigures = [histogram, winLoss].filter((figure): figure is FigurePayload => Boolean(figure && hasData(figure)));
  const engineHistogramProvenance = asString(distribution.metadata?.histogram_provenance) ?? (histogram?.note?.toLowerCase().includes("derived") ? "derived_from_persisted_trades" : "engine_emitted");
  const hasExcursion = toBoolean(distribution.metadata?.has_excursion) ?? figures.some((figure) => figure.title.toLowerCase().includes("mae") || figure.title.toLowerCase().includes("mfe"));
  const hasDuration = toBoolean(distribution.metadata?.has_duration) ?? distribution.metrics.some((metric) => metric.label.toLowerCase().includes("duration") && !isUnavailable(metric.value));

  const assumptions = distribution.assumptions ?? [];
  const limitations = distribution.limitations ?? [];
  const recommendations = distribution.recommendations ?? [];
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
          { label: "Returns", value: histogram ? "available" : "unavailable" },
          { label: "Win/loss profile", value: winLoss ? "available" : "limited" },
          { label: "MAE/MFE", value: hasExcursion ? "available" : "unavailable" },
          { label: "Duration", value: hasDuration ? "available" : "unavailable" },
        ].map((item) => (
          <div key={item.label} className="rounded-full border border-border-subtle bg-surface-panel px-3 py-1 text-xs text-text-neutral">
            <span className="font-medium text-text-graphite">{item.label}:</span> {item.value}
          </div>
        ))}
      </div>

      <MetricRow metrics={metricsFromScoreBands(renderedMetrics)} cols={4} />

      <div className="space-y-4">
        {primaryFigures.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {primaryFigures.map((figure) => (
              <FigureCard
                key={figure.figure_id}
                title={figure.title}
                subtitle={figure.subtitle}
                figure={<DiagnosticFigure figure={figure} />}
                note={figure.note}
                metadata={
                  figure.figure_id === histogram?.figure_id
                    ? <span className="rounded-full border border-border-subtle px-2 py-0.5">{engineHistogramProvenance === "engine_emitted" ? "Engine-native histogram" : "Reconstructed from persisted trades"}</span>
                    : undefined
                }
              />
            ))}
          </div>
        ) : null}

        {(secondaryAvailable.length || additionalAvailable.length) ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {[...secondaryAvailable, ...additionalAvailable].map((figure) => (
              <FigureCard key={figure.figure_id} title={figure.title} subtitle={figure.subtitle} figure={<DiagnosticFigure figure={figure} />} note={figure.note} />
            ))}
          </div>
        ) : null}

        {unavailableDiagnostics.length ? (
          <WorkspaceCard title="Unavailable diagnostics" subtitle="These secondary views were not emitted with chartable series for this run.">
            <ul className="space-y-1 text-sm text-text-neutral">
              {unavailableDiagnostics.map((figure) => (
                <li key={figure.figure_id}>• <span className="font-medium text-text-graphite">{figure.title}</span>{figure.note ? ` — ${figure.note}` : ""}</li>
              ))}
            </ul>
          </WorkspaceCard>
        ) : null}
      </div>

      <WorkspaceCard title="Distribution shape insights" subtitle="How outcomes cluster and where asymmetry appears in this run.">
        {keyShapeFindings.length ? (
          <ul className="space-y-1.5 text-sm text-text-neutral">
            {keyShapeFindings.map((item) => <li key={item}>• {item}</li>)}
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

      <WorkspaceCard title="Distribution context" subtitle="Engine-native framing of assumptions, limitations, and recommendations.">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-text-graphite">Assumptions</p>
            {assumptions.length ? <ul className="mt-1.5 space-y-1 text-sm text-text-neutral">{assumptions.map((item) => <li key={item}>• {item}</li>)}</ul> : <p className="mt-1.5 text-sm text-text-neutral">No explicit assumptions were emitted for this run.</p>}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-text-graphite">Limitations</p>
            {limitations.length ? <ul className="mt-1.5 space-y-1 text-sm text-text-neutral">{limitations.map((item) => <li key={item}>• {item}</li>)}</ul> : <p className="mt-1.5 text-sm text-text-neutral">No explicit limitations were emitted for this run.</p>}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-text-graphite">Recommendations</p>
            {recommendations.length ? <ul className="mt-1.5 space-y-1 text-sm text-text-neutral">{recommendations.map((item) => <li key={item}>• {item}</li>)}</ul> : <p className="mt-1.5 text-sm text-text-neutral">No explicit recommendations were emitted for this run.</p>}
          </div>
        </div>
      </WorkspaceCard>

      <WorkspaceCard title="What this page does not yet include" subtitle="Richer artifacts unlock additional conditional distribution diagnostics.">
        <ul className="space-y-1 text-sm text-text-neutral">
          {!hasExcursion ? <li>• No MAE/MFE excursion decomposition because excursion fields were not present.</li> : null}
          <li>• No regime-conditioned distribution split on this page.</li>
          <li>• No parameter-conditioned distribution surface on this page.</li>
        </ul>
      </WorkspaceCard>

      <InterpretationBlock
        {...toInterpretationBlockPayload({
          ...record.diagnostics.distribution.interpretation,
          summary: distribution.interpretation.summary,
          positives: keyShapeFindings.slice(0, 2),
          cautions: limitations.slice(0, 3),
          caveats: [
            ...(!hasExcursion ? ["MAE/MFE excursion decomposition was unavailable for this run."] : []),
            "Regime-conditioned distribution is out of scope for this page.",
            "Parameter-conditioned distribution is out of scope for this page.",
          ].slice(0, 3),
          bullets: recommendations.slice(0, 3),
        })}
      />
    </AnalysisPageFrame>
  );
}
