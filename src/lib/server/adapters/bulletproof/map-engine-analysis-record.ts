import { randomUUID } from "node:crypto";
import { analysisRecordSchema, type AnalysisRecord, type FigurePayload, type ScoreBand, type WarningItem } from "@/lib/contracts";
import type { EngineCapabilityProfile, EngineRunContext, EngineAnalysisResult } from "@/lib/server/engine/engine-types";
import type { ParsedArtifact, UploadEligibilitySummary } from "@/lib/server/ingestion";

const DIAGNOSTICS = ["overview", "distribution", "monte_carlo", "stability", "execution", "regimes", "ruin", "report"] as const;
type DiagnosticName = (typeof DIAGNOSTICS)[number];

type FinalStatus = "available" | "limited" | "unavailable" | "skipped";
type UnknownRecord = Record<string, unknown>;

function score(label: string, value: string, band: ScoreBand["band"]): ScoreBand {
  return { label, value, band };
}

function asRecord(value: unknown): UnknownRecord | undefined {
  return value && typeof value === "object" ? (value as UnknownRecord) : undefined;
}

function pickFirstRecord(source: UnknownRecord | undefined, keys: string[]): UnknownRecord | undefined {
  if (!source) return undefined;
  for (const key of keys) {
    const entry = asRecord(source[key]);
    if (entry) return entry;
  }
  return undefined;
}

function getNumber(source: UnknownRecord | undefined, keys: string[]): number | undefined {
  if (!source) return undefined;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return undefined;
}

function getString(source: UnknownRecord | undefined, keys: string[]): string | undefined {
  if (!source) return undefined;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim().length) return value;
  }
  return undefined;
}

function getStringArray(source: UnknownRecord | undefined, keys: string[]): string[] {
  if (!source) return [];
  for (const key of keys) {
    const value = source[key];
    if (!Array.isArray(value)) continue;
    const items = value
      .map((item) => {
        if (typeof item === "string") return item.trim();
        const record = asRecord(item);
        return getString(record, ["message", "text", "value", "label", "title"])?.trim();
      })
      .filter((item): item is string => Boolean(item));
    if (items.length > 0) return items;
  }
  return [];
}

function normalizeText(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function normalizeMetric(metric: unknown, index: number) {
  const item = asRecord(metric);
  if (!item) return undefined;
  const label = getString(item, ["label", "name", "title", "metric"]) ?? `Metric ${index + 1}`;
  const rawValue = item.value ?? item.formatted_value ?? item.display_value ?? item.metric_value;
  const valueText = normalizeText(rawValue) ?? "Unavailable";
  const numericValue = typeof rawValue === "number" && Number.isFinite(rawValue) ? rawValue : getNumber(item, ["numeric_value", "numericValue"]);
  const band = getString(item, ["band", "severity"]);
  const normalizedBand = band === "excellent" || band === "good" || band === "moderate" || band === "elevated" || band === "critical" || band === "informational"
    ? band
    : undefined;
  return {
    key: getString(item, ["key", "id", "slug"]) ?? `metric_${index + 1}`,
    label,
    value: valueText,
    numeric_value: numericValue,
    band: normalizedBand,
  };
}

function formatPct(value: number | undefined): string {
  return value === undefined ? "Unavailable" : `${value.toFixed(1)}%`;
}

function pctBand(value: number | undefined, low: number, high: number): ScoreBand["band"] {
  if (value === undefined) return "informational";
  if (value >= high) return "critical";
  if (value >= low) return "elevated";
  return "moderate";
}

function formatNumber(value: number | undefined, digits = 2): string {
  if (value === undefined || !Number.isFinite(value)) return "Unavailable";
  return value.toFixed(digits);
}

function formatDuration(seconds: number | undefined): string {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds <= 0) return "Unavailable";
  if (seconds >= 86_400) return `${(seconds / 86_400).toFixed(2)} days`;
  if (seconds >= 3_600) return `${(seconds / 3_600).toFixed(2)} hours`;
  if (seconds >= 60) return `${(seconds / 60).toFixed(2)} min`;
  return `${seconds.toFixed(0)} sec`;
}

function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function buildTradeDerivedStats(parsedArtifact: ParsedArtifact) {
  const pnl = parsedArtifact.trades.map((trade) => trade.pnl).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const durations = parsedArtifact.trades.map((trade) => trade.duration_seconds).filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0);

  if (pnl.length === 0) {
    return {
      totalPnl: undefined,
      averagePnl: undefined,
      medianPnl: undefined,
      winRatePct: undefined,
      expectancy: undefined,
      avgDurationSeconds: durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : undefined,
      equitySeries: [] as FigurePayload["series"],
      histogramSeries: [] as FigurePayload["series"],
    };
  }

  const totalPnl = pnl.reduce((sum, value) => sum + value, 0);
  const wins = pnl.filter((value) => value > 0).length;
  const winRatePct = (wins / pnl.length) * 100;
  const avg = totalPnl / pnl.length;
  const med = median(pnl);
  let runningEquity = 0;

  const equitySeries: FigurePayload["series"] = [
    {
      key: "derived-equity",
      label: "Cumulative PnL",
      series_type: "line",
      points: pnl.map((value, idx) => {
        runningEquity += value;
        return { x: idx + 1, y: Number(runningEquity.toFixed(6)) };
      }),
    },
  ];

  const min = Math.min(...pnl);
  const max = Math.max(...pnl);
  const binCount = Math.min(12, Math.max(5, Math.ceil(Math.sqrt(pnl.length))));
  const width = max === min ? 1 : (max - min) / binCount;
  const bins = Array.from({ length: binCount }, (_, idx) => ({ low: min + idx * width, high: min + (idx + 1) * width, count: 0 }));
  for (const value of pnl) {
    const rawIndex = width === 0 ? 0 : Math.floor((value - min) / width);
    const index = Math.min(binCount - 1, Math.max(0, rawIndex));
    bins[index].count += 1;
  }

  const histogramSeries: FigurePayload["series"] = [
    {
      key: "derived-pnl-histogram",
      label: "PnL Frequency",
      series_type: "bar",
      points: bins.map((bin, idx) => ({ x: `${idx + 1}`, y: bin.count })),
    },
  ];

  return {
    totalPnl,
    averagePnl: avg,
    medianPnl: med,
    winRatePct,
    expectancy: avg,
    avgDurationSeconds: durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : undefined,
    equitySeries,
    histogramSeries,
  };
}

function toFigureSeries(items: unknown): FigurePayload["series"] {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      const entry = asRecord(item);
      const points = Array.isArray(entry?.points)
        ? entry.points
            .map((point) => {
              const p = asRecord(point);
              const y = p?.y;
              if ((typeof p?.x !== "number" && typeof p?.x !== "string") || typeof y !== "number" || !Number.isFinite(y)) return undefined;
              return { x: p.x, y };
            })
            .filter((point): point is { x: string | number; y: number } => Boolean(point))
        : [];

      if (!entry?.key || !entry?.label || !points.length) return undefined;

      const seriesType = entry.series_type;
      const normalizedType = seriesType === "line" || seriesType === "area" || seriesType === "bar" || seriesType === "scatter" ? seriesType : "line";
      return {
        key: String(entry.key),
        label: String(entry.label),
        series_type: normalizedType,
        points,
      };
    })
    .filter((entry): entry is FigurePayload["series"][number] => Boolean(entry));
}

function mapFigure(payload: unknown, fallback: { title: string; type: FigurePayload["type"]; note: string }): FigurePayload {
  const figure = asRecord(payload);
  return {
    figure_id: getString(figure, ["figure_id", "figureId"]) ?? randomUUID(),
    title: getString(figure, ["title"]) ?? fallback.title,
    subtitle: getString(figure, ["subtitle"]),
    type: (() => {
      const rawType = getString(figure, ["type"]);
      if (rawType === "line" || rawType === "area" || rawType === "bar" || rawType === "grouped_bar" || rawType === "histogram" || rawType === "scatter" || rawType === "fan" || rawType === "fan_chart" || rawType === "heatmap" || rawType === "table") return rawType;
      return fallback.type;
    })(),
    series: toFigureSeries(figure?.series),
    x_label: getString(figure, ["x_label", "xLabel"]),
    y_label: getString(figure, ["y_label", "yLabel"]),
    legend: Array.isArray(figure?.legend)
      ? figure.legend
          .map((item) => {
            const legend = asRecord(item);
            const key = getString(legend, ["key"]);
            const label = getString(legend, ["label"]);
            return key && label ? { key, label } : undefined;
          })
          .filter((item): item is { key: string; label: string } => Boolean(item))
      : undefined,
    note: getString(figure, ["note"]) ?? fallback.note,
  };
}

function mapFigureList(payload: unknown, fallback: { title: string; type: FigurePayload["type"]; note: string }): FigurePayload[] {
  if (Array.isArray(payload)) {
    return payload.map((entry) => mapFigure(entry, fallback)).filter((figure) => figure.series.length > 0 || Boolean(figure.note));
  }
  const single = mapFigure(payload, fallback);
  return single.series.length > 0 ? [single] : [];
}

function statusText(status: FinalStatus | undefined, availableText: string, unavailableText: string): string {
  return status === "available" ? availableText : unavailableText;
}

function reconcileDiagnosticStatus(eligibility: UploadEligibilitySummary, capability?: EngineCapabilityProfile) {
  const base = new Map<DiagnosticName, FinalStatus>();

  for (const name of DIAGNOSTICS) {
    if (eligibility.diagnostics_unavailable.includes(name)) base.set(name, "unavailable");
    else if (eligibility.diagnostics_limited.includes(name)) base.set(name, "limited");
    else if (eligibility.diagnostics_available.includes(name)) base.set(name, "available");
    else base.set(name, "unavailable");

    const engineStatus = capability?.[name]?.status;
    if (engineStatus === "unavailable" || engineStatus === "skipped") base.set(name, engineStatus);
    else if (engineStatus === "limited" && base.get(name) === "available") base.set(name, "limited");
  }

  return base;
}

function pickDiagnosticEnvelope(raw: UnknownRecord | undefined): UnknownRecord | undefined {
  if (!raw) return undefined;
  return pickFirstRecord(raw, ["diagnostic_envelope", "envelope", "payload"]) ?? raw;
}

function envelopeMetricToScore(metric: NonNullable<ReturnType<typeof normalizeMetric>>): ScoreBand {
  return {
    label: metric.label,
    value: metric.value,
    band: metric.band ?? "informational",
  };
}

export function mapEngineAnalysisResultToAnalysisRecord(params: {
  analysisId: string;
  parsedArtifact: ParsedArtifact;
  eligibility: UploadEligibilitySummary;
  engine: EngineAnalysisResult;
  engineContext: EngineRunContext;
}): AnalysisRecord {
  const { analysisId, parsedArtifact, eligibility, engine, engineContext } = params;
  const now = new Date().toISOString();
  const firstTrade = parsedArtifact.trades[0];
  const lastTrade = parsedArtifact.trades[parsedArtifact.trades.length - 1];
  const statusByDiagnostic = reconcileDiagnosticStatus(eligibility, engine.capability_profile);
  const skippedNotes = engine.skipped_diagnostics?.map((item) => `${item.diagnostic}: ${item.reason}`) ?? [];

  const diagnostics = asRecord(engine.diagnostics);
  const overviewRaw = pickDiagnosticEnvelope(pickFirstRecord(diagnostics, ["overview"]));
  const distributionRaw = pickDiagnosticEnvelope(pickFirstRecord(diagnostics, ["distribution"]));
  const monteCarloRaw = pickDiagnosticEnvelope(pickFirstRecord(diagnostics, ["monte_carlo", "monteCarlo"]));
  const executionRaw = pickDiagnosticEnvelope(pickFirstRecord(diagnostics, ["execution"]));
  const regimesRaw = pickDiagnosticEnvelope(pickFirstRecord(diagnostics, ["regimes"]));
  const ruinRaw = pickDiagnosticEnvelope(pickFirstRecord(diagnostics, ["ruin"]));
  const stabilityRaw = pickDiagnosticEnvelope(pickFirstRecord(diagnostics, ["stability"]));
  const reportRaw = pickDiagnosticEnvelope(pickFirstRecord(diagnostics, ["report"]));
  const derivedStats = buildTradeDerivedStats(parsedArtifact);

  const warnings: WarningItem[] = [
    ...eligibility.limitation_reasons.map((reason, idx) => ({
      code: `ELIGIBILITY_${idx + 1}`,
      severity: "warning" as const,
      title: "Diagnostic limitation",
      message: reason,
    })),
    ...(engine.summary?.warnings?.map((warning) => ({
      code: warning.code,
      severity: warning.severity ?? "warning",
      title: "Engine warning",
      message: warning.message,
    })) ?? []),
    ...skippedNotes.map((note, idx) => ({
      code: `ENGINE_SKIPPED_${idx + 1}`,
      severity: "info" as const,
      title: "Diagnostic skipped",
      message: note,
    })),
  ];
  const monteCarloScopedWarnings = [
    ...getStringArray(monteCarloRaw, ["warnings"]),
    ...getStringArray(monteCarloRaw, ["limitations"]),
    ...warnings
      .map((warning) => warning.message)
      .filter((message) => /monte|simulation|bootstrap|iid|serial|regime|liquidity|ruin/i.test(message)),
  ].filter((warning, idx, arr) => warning.length > 0 && arr.indexOf(warning) === idx);

  const robustness = engine.summary?.robustness_score ?? getNumber(overviewRaw, ["robustness_score", "robustnessScore", "score"]);
  const overfit = engine.summary?.overfitting_risk_pct ?? getNumber(overviewRaw, ["overfitting_risk_pct", "overfittingRiskPct"]);
  const mcWorst = getNumber(monteCarloRaw, ["worst_drawdown_pct", "worstDrawdownPct"]);
  const mcP95 = getNumber(monteCarloRaw, ["p95_drawdown_pct", "drawdown_p95_pct", "p95DrawdownPct"]);
  const mcMedian = getNumber(monteCarloRaw, ["median_drawdown_pct", "medianDrawdownPct"]);
  const ruinProbability = getNumber(ruinRaw, ["ruin_probability_pct", "ruinProbabilityPct", "probability_of_ruin_pct"])
    ?? getNumber(monteCarloRaw, ["ruin_probability_pct", "ruinProbabilityPct"]);

  const verdict = engine.summary?.verdict ?? (robustness !== undefined && robustness >= 70 ? "robust" : robustness !== undefined && robustness >= 50 ? "moderate" : "fragile");

  const reportDiagnosticRows = DIAGNOSTICS.map((name) => `${name}: ${statusByDiagnostic.get(name)}`);
  const globalSummaryMetrics = Array.isArray(engine.summary && (engine.summary as unknown as UnknownRecord).summary_metrics)
    ? ((engine.summary as unknown as UnknownRecord).summary_metrics as unknown[]).map(normalizeMetric).filter((metric): metric is NonNullable<ReturnType<typeof normalizeMetric>> => Boolean(metric))
    : [];

  const envelopeByDiagnostic = Object.fromEntries(
    DIAGNOSTICS.map((name) => {
      const raw = pickDiagnosticEnvelope(pickFirstRecord(diagnostics, [name]));
      const status = statusByDiagnostic.get(name);
      const summaryMetrics = Array.isArray(raw?.summary_metrics) ? raw.summary_metrics.map(normalizeMetric).filter((metric): metric is NonNullable<ReturnType<typeof normalizeMetric>> => Boolean(metric)) : [];
      const figures = mapFigureList(raw?.figures ?? raw?.figure, { title: `${name} figure`, type: "line", note: "Engine-native figure payload." });
      const interpretation = getString(raw, ["interpretation", "summary", "narrative"]);
      return [name, {
        status,
        summary_metrics: summaryMetrics,
        figures,
        interpretation,
        assumptions: getStringArray(raw, ["assumptions"]),
        warnings: getStringArray(raw, ["warnings"]),
        recommendations: getStringArray(raw, ["recommendations"]),
        limitations: getStringArray(raw, ["limitations"]),
        metadata: asRecord(raw?.metadata),
      }];
    }),
  ) as AnalysisRecord["engine_payload"]["diagnostics"];
  const mappedOverviewFigure = mapFigure(overviewRaw?.figure ?? overviewRaw?.equity_comparison_figure ?? overviewRaw?.figures?.[0], {
    title: "Equity Comparison",
    type: "line",
    note: statusText(statusByDiagnostic.get("overview"), "Engine-backed series supplied where available.", "Figure is bounded by current artifact richness/capability."),
  });

  const overviewFigureProvenance = mappedOverviewFigure.series.length > 0 ? "engine_emitted" : "reconstructed_from_trades";
  const overviewFigure: FigurePayload = mappedOverviewFigure.series.length > 0
    ? { ...mappedOverviewFigure, title: "Top-line equity view", note: "Engine-emitted overview equity series for top-line review." }
    : {
        ...mappedOverviewFigure,
        title: "Top-line equity view",
        note: "Engine overview series unavailable; cumulative PnL was reconstructed from persisted trade-level PnL.",
        series: derivedStats.equitySeries,
      };

  if (envelopeByDiagnostic.overview) {
    envelopeByDiagnostic.overview.metadata = {
      ...(envelopeByDiagnostic.overview.metadata ?? {}),
      overview_figure_provenance: overviewFigureProvenance,
      benchmark_status: parsedArtifact.benchmark_present ? "available" : "pending",
      artifact_richness: parsedArtifact.richness,
      execution_context_level: statusByDiagnostic.get("execution") ?? "limited",
      figure_series_count: overviewFigure.series.length,
    };
  }

  const mappedDistributionHistogram = mapFigure(distributionRaw?.histogram_figure ?? distributionRaw?.histogram ?? distributionRaw?.figures?.[0], {
    title: "Outcome Distribution",
    type: "histogram",
    note: "Distribution histogram shown when engine emits bin data.",
  });
  const distributionHistogramProvenance = mappedDistributionHistogram.series.length > 0 ? "engine_emitted" : "derived_from_persisted_trades";
  const distributionHistogram: FigurePayload = mappedDistributionHistogram.series.length > 0
    ? mappedDistributionHistogram
    : { ...mappedDistributionHistogram, title: "Trade PnL distribution (derived)", note: "Histogram bins were derived from persisted trade-level PnL because engine histogram bins were not emitted.", series: derivedStats.histogramSeries };

  if (envelopeByDiagnostic.distribution) {
    const hasDuration = parsedArtifact.trades.some((trade) => typeof trade.duration_seconds === "number" && Number.isFinite(trade.duration_seconds));
    const hasExcursion = parsedArtifact.trades.some((trade) => typeof trade.mae === "number" || typeof trade.mfe === "number");
    envelopeByDiagnostic.distribution.metadata = {
      ...(envelopeByDiagnostic.distribution.metadata ?? {}),
      histogram_provenance: distributionHistogramProvenance,
      trade_count: parsedArtifact.trades.length,
      coverage_start: firstTrade?.entry_time,
      coverage_end: lastTrade?.exit_time,
      has_duration: hasDuration,
      has_excursion: hasExcursion,
      has_win_loss_profile: parsedArtifact.trades.some((trade) => typeof trade.pnl === "number" && Number.isFinite(trade.pnl)),
    };
  }

  if (envelopeByDiagnostic.monte_carlo) {
    const simulationCount = getNumber(monteCarloRaw, ["simulations", "paths", "n_paths", "num_paths", "simulation_count"]);
    const horizonDays = getNumber(monteCarloRaw, ["horizon_days", "horizonDays", "horizon"]);
    const method = getString(monteCarloRaw, ["method", "sampling_method", "bootstrap_method"]) ?? "bootstrap_iid";
    const ruinThreshold = getNumber(monteCarloRaw, ["ruin_threshold_pct", "ruinThresholdPct", "ruin_threshold"]);
    envelopeByDiagnostic.monte_carlo.metadata = {
      ...(envelopeByDiagnostic.monte_carlo.metadata ?? {}),
      simulations: simulationCount,
      horizon_days: horizonDays,
      method,
      ruin_threshold_pct: ruinThreshold,
      figure_series_count: envelopeByDiagnostic.monte_carlo.figures?.[0]?.series.length ?? 0,
      has_fan_chart: (envelopeByDiagnostic.monte_carlo.figures?.[0]?.type === "fan" || envelopeByDiagnostic.monte_carlo.figures?.[0]?.type === "fan_chart"),
    };
  }

  const record: AnalysisRecord = {
    analysis_id: analysisId,
    status: "completed",
    created_at: now,
    updated_at: now,
    strategy: {
      strategy_name: parsedArtifact.strategy_metadata?.strategy_name ?? firstTrade?.strategy_name ?? `Upload ${analysisId.slice(0, 8)}`,
      symbols: Array.from(new Set(parsedArtifact.trades.map((trade) => trade.symbol))).slice(0, 8),
      timeframe: firstTrade?.timeframe,
      source_type: "upload",
      asset_class: firstTrade?.market,
      description: `Artifact classified as ${parsedArtifact.richness}.`,
    },
    dataset: {
      market: firstTrade?.market,
      broker_or_exchange: firstTrade?.exchange,
      start_date: firstTrade?.entry_time,
      end_date: lastTrade?.exit_time,
      trade_count: parsedArtifact.trades.length,
      currency: "USD",
    },
    run_context: {
      execution_model: statusText(statusByDiagnostic.get("execution"), "Execution assumptions supplied", "Execution assumptions constrained"),
      monte_carlo: statusText(statusByDiagnostic.get("monte_carlo"), "Engine-backed monte carlo", "Monte Carlo constrained by eligibility/capability"),
      risk_model: "bulletproof_bt normalized seam",
      notes: [eligibility.summary_text, ...engineContext.degradation_reasons, ...(parsedArtifact.parser_notes ?? [])].filter(Boolean).join(" | "),
    },
    summary: {
      robustness_score: score("Robustness Score", robustness !== undefined ? `${Math.round(robustness)} / 100` : "Unavailable", robustness !== undefined ? (robustness >= 70 ? "good" : "moderate") : "informational"),
      overfitting_risk: score("Overfitting Risk", overfit !== undefined ? `${Math.round(overfit)}%` : "Unavailable", pctBand(overfit, 30, 45)),
      execution_resilience: score("Execution Resilience", statusByDiagnostic.get("execution") ?? "unavailable", statusByDiagnostic.get("execution") === "available" ? "moderate" : "informational"),
      capital_survivability: score("Risk of Ruin", formatPct(ruinProbability), pctBand(ruinProbability, 5, 12)),
      headline_verdict: {
        status: verdict,
        title: verdict === "robust" ? "Robust profile under current assumptions" : verdict === "moderate" ? "Moderate profile with bounded fragility" : "Fragile profile under stress assumptions",
        summary: engine.summary?.short_summary ?? eligibility.summary_text,
      },
      short_summary: engine.summary?.short_summary ?? "Analysis generated through bulletproof_bt seam with eligibility-aware reconciliation.",
      key_findings: engine.summary?.key_findings?.length
        ? engine.summary.key_findings
        : [
            `Total realized PnL from persisted trades: ${formatNumber(derivedStats.totalPnl, 2)}.`,
            `Trade-level win rate: ${formatPct(derivedStats.winRatePct)}.`,
            `Worst Monte Carlo drawdown: ${formatPct(mcWorst)}.`,
            `Ruin probability estimate: ${formatPct(ruinProbability)}.`,
            `${eligibility.diagnostics_available.length} diagnostics eligible at upload inspection.`,
          ],
      warnings,
    },
    diagnostics: {
      overview: {
        metrics: envelopeByDiagnostic.overview?.summary_metrics.length
          ? envelopeByDiagnostic.overview.summary_metrics.map(envelopeMetricToScore)
          : [
          score("Robustness Score", robustness !== undefined ? `${Math.round(robustness)} / 100` : "Unavailable", robustness !== undefined ? (robustness >= 70 ? "good" : "moderate") : "informational"),
          score("Overfitting Risk", overfit !== undefined ? `${Math.round(overfit)}%` : "Unavailable", pctBand(overfit, 30, 45)),
          score("Trade Count", `${parsedArtifact.trades.length}`, "informational"),
          score("Win Rate", formatPct(derivedStats.winRatePct), pctBand(derivedStats.winRatePct, 45, 60)),
          score("Worst Monte Carlo Drawdown", formatPct(mcWorst), pctBand(Math.abs(mcWorst ?? 0), 25, 40)),
          score("Risk-of-Ruin Probability", formatPct(ruinProbability), pctBand(ruinProbability, 5, 12)),
        ],
        figure: overviewFigure,
        interpretation: {
          title: "Overview interpretation",
          summary: envelopeByDiagnostic.overview?.interpretation ?? statusText(
            statusByDiagnostic.get("overview"),
            "Top-line diagnostics combine robustness, overfitting, Monte Carlo tail stress, and ruin sensitivity.",
            "Overview is available with bounded depth due to upload richness and engine capability limits.",
          ),
          bullets: [
            ...(engine.summary?.key_findings ?? []).slice(0, 3),
            ...warnings.slice(0, 2).map((warning) => warning.message),
          ].slice(0, 4),
        },
        verdict: {
          status: verdict,
          title: verdict === "robust" ? "Robust profile under current assumptions" : verdict === "moderate" ? "Moderate profile with bounded fragility" : "Fragile profile under stress assumptions",
          summary: engine.summary?.short_summary ?? eligibility.summary_text,
        },
      },
      distribution: {
        metrics: envelopeByDiagnostic.distribution?.summary_metrics.length
          ? envelopeByDiagnostic.distribution.summary_metrics.map(envelopeMetricToScore)
          : [
          score("Expectancy", getString(distributionRaw, ["expectancy", "expectancy_r", "expectancyR"]) ?? formatNumber(derivedStats.expectancy, 4), "moderate"),
          score("Win Rate", formatPct(getNumber(distributionRaw, ["win_rate_pct", "winRatePct"]) ?? derivedStats.winRatePct), pctBand(getNumber(distributionRaw, ["win_rate_pct", "winRatePct"]) ?? derivedStats.winRatePct, 45, 60)),
          score("Median Return", getString(distributionRaw, ["median_return", "median_r", "medianReturn"]) ?? formatNumber(derivedStats.medianPnl, 4), "informational"),
          score("Mean Duration", getString(distributionRaw, ["mean_duration", "meanDuration", "avg_duration"]) ?? formatDuration(derivedStats.avgDurationSeconds), "informational"),
        ],
        figures: [
          distributionHistogram,
          mapFigure(distributionRaw?.scatter_figure ?? distributionRaw?.scatter ?? distributionRaw?.figures?.[1], { title: "MAE / MFE Behavior", type: "scatter", note: "Scatter requires excursion fields; absent fields remain intentionally limited." }),
          ...(envelopeByDiagnostic.distribution?.figures ?? []).filter((figure) => ![distributionHistogram.figure_id].includes(figure.figure_id)),
        ],
        interpretation: {
          title: "Distribution interpretation",
          summary: statusText(statusByDiagnostic.get("distribution"), "Distribution metrics describe trade behavior, expectancy shape, and duration structure.", "Distribution view is limited by available artifact fields."),
          bullets: statusByDiagnostic.get("distribution") === "available" ? ["Expectancy and win-rate are engine-derived.", "Duration and dispersion are presented without overclaiming missing MAE/MFE fields."] : ["Upload lacked richer excursion context for full behavior decomposition."],
        },
      },
      monte_carlo: {
        metrics: envelopeByDiagnostic.monte_carlo?.summary_metrics.length
          ? envelopeByDiagnostic.monte_carlo.summary_metrics.map(envelopeMetricToScore)
          : [
          score("Worst Simulated Drawdown", formatPct(mcWorst), pctBand(Math.abs(mcWorst ?? 0), 25, 40)),
          score("95th Percentile Drawdown", formatPct(mcP95), pctBand(Math.abs(mcP95 ?? 0), 20, 35)),
          score("Median Drawdown", formatPct(mcMedian), pctBand(Math.abs(mcMedian ?? 0), 12, 25)),
          score("P(Ruin)", formatPct(ruinProbability), pctBand(ruinProbability, 5, 12)),
        ],
        figure: mapFigure(envelopeByDiagnostic.monte_carlo?.figures[0] ?? monteCarloRaw?.fan_chart_figure ?? monteCarloRaw?.figure, {
          title: "Monte Carlo Equity Fan",
          type: "fan_chart",
          note: statusText(statusByDiagnostic.get("monte_carlo"), "Fan-chart payload reflects engine-supplied simulation paths.", "Monte Carlo figure is constrained by simulation depth emitted by engine."),
        }),
        interpretation: {
          title: "Monte Carlo interpretation",
          summary: getString(monteCarloRaw, ["summary", "interpretation", "narrative"]) ?? statusText(
            statusByDiagnostic.get("monte_carlo"),
            "Simulation outputs provide tail-risk and survivability context under sequence perturbation.",
            "Monte Carlo diagnostics are available with bounded confidence due to limited assumptions/capability.",
          ),
          positives: getStringArray(monteCarloRaw, ["positives", "strengths"]),
          cautions: getStringArray(monteCarloRaw, ["cautions", "risks", "warning_points"]),
          caveats: getStringArray(monteCarloRaw, ["key_caveats", "caveats", "limitations"]),
          bullets: [
            `Worst drawdown estimate: ${formatPct(mcWorst)}.`,
            `95th percentile drawdown: ${formatPct(mcP95)}.`,
            ruinProbability === undefined ? "Ruin probability estimate was not emitted by the engine for this run." : `Ruin probability estimate: ${formatPct(ruinProbability)}.`,
          ],
        },
        warnings: monteCarloScopedWarnings.length
          ? monteCarloScopedWarnings.map((message, idx) => ({
              code: `MC_NOTE_${idx + 1}`,
              severity: "warning",
              title: "Monte Carlo note",
              message,
            }))
          : warnings.filter((warning) => /monte|simulation|bootstrap|iid|serial|regime|liquidity|ruin/i.test(warning.message)),
      },
      stability: {
        metrics: envelopeByDiagnostic.stability?.summary_metrics.length
          ? envelopeByDiagnostic.stability.summary_metrics.map(envelopeMetricToScore)
          : [score("Stability Coverage", statusByDiagnostic.get("stability") ?? "unavailable", statusByDiagnostic.get("stability") === "available" ? "moderate" : "informational")],
        figure: envelopeByDiagnostic.stability?.figures[0],
        interpretation: {
          title: "Stability interpretation",
          summary: statusText(statusByDiagnostic.get("stability"), "Stability proxy is provided from available sensitivity outputs.", "Parameter-surface topology is not fully available for this run; interpretation remains limited."),
          bullets: getString(stabilityRaw, ["limitation_note", "note"]) ? [getString(stabilityRaw, ["limitation_note", "note"]) as string] : undefined,
        },
        locked: statusByDiagnostic.get("stability") !== "available",
      },
      execution: {
        metrics: envelopeByDiagnostic.execution?.summary_metrics.length
          ? envelopeByDiagnostic.execution.summary_metrics.map(envelopeMetricToScore)
          : [
          score("Baseline Expectancy", getString(executionRaw, ["baseline_expectancy", "baselineExpectancy"]) ?? "Unavailable", "moderate"),
          score("Stressed Expectancy", getString(executionRaw, ["stressed_expectancy", "stressedExpectancy"]) ?? "Unavailable", "elevated"),
          score("Edge Decay", getString(executionRaw, ["edge_decay", "edgeDecay"]) ?? "Unavailable", "elevated"),
        ],
        scenarios: Array.isArray(executionRaw?.scenarios)
          ? executionRaw.scenarios
              .map((item) => {
                const scenario = asRecord(item);
                const name = getString(scenario, ["name"]);
                const assumption = getString(scenario, ["assumption"]);
                const impact = getString(scenario, ["impact"]);
                return name && assumption && impact ? { name, assumption, impact } : undefined;
              })
              .filter((item): item is { name: string; assumption: string; impact: string } => Boolean(item))
          : [],
        figure: mapFigure(envelopeByDiagnostic.execution?.figures[0] ?? executionRaw?.scenario_figure ?? executionRaw?.figure, {
          title: "Execution Friction Sensitivity",
          type: "line",
          note: "Execution scenario chart is shown when sufficient friction assumptions are available.",
        }),
        interpretation: {
          title: "Execution interpretation",
          summary: statusText(statusByDiagnostic.get("execution"), "Execution sensitivity reflects expectancy decay under worsened friction assumptions.", "Execution diagnostic remains limited because richer slippage/cost assumptions are not fully available."),
        },
      },
      regimes: {
        metrics: envelopeByDiagnostic.regimes?.summary_metrics.length
          ? envelopeByDiagnostic.regimes.summary_metrics.map(envelopeMetricToScore)
          : [score("Regime Diagnostic Status", statusByDiagnostic.get("regimes") ?? "unavailable", statusByDiagnostic.get("regimes") === "available" ? "moderate" : "informational")],
        figures: [
          mapFigure(regimesRaw?.regime_bar_figure ?? regimesRaw?.figure, {
            title: "Regime Proxy Summary",
            type: "bar",
            note: "Regime figures are shown as proxy summaries unless richer OHLCV regime context is supplied.",
          }),
          ...(envelopeByDiagnostic.regimes?.figures ?? []),
        ],
        interpretation: {
          title: "Regime interpretation",
          summary: statusText(statusByDiagnostic.get("regimes"), "Regime-aware behavior is reported from available context.", "Regime analysis is intentionally limited without richer market-state context (e.g., OHLCV/regime labels)."),
        },
        locked: statusByDiagnostic.get("regimes") !== "available",
      },
      ruin: {
        metrics: envelopeByDiagnostic.ruin?.summary_metrics.length
          ? envelopeByDiagnostic.ruin.summary_metrics.map(envelopeMetricToScore)
          : [
          score("Probability of Ruin", formatPct(ruinProbability), pctBand(ruinProbability, 5, 12)),
          score("Expected Stress Drawdown", formatPct(getNumber(ruinRaw, ["stress_drawdown_pct", "stressDrawdownPct"])), pctBand(Math.abs(getNumber(ruinRaw, ["stress_drawdown_pct", "stressDrawdownPct"]) ?? 0), 25, 40)),
        ],
        assumptions: [
          { name: "Artifact Richness", value: parsedArtifact.richness },
          { name: "Trade Count", value: `${parsedArtifact.trades.length}` },
        ],
        figure: mapFigure(envelopeByDiagnostic.ruin?.figures[0] ?? ruinRaw?.figure ?? ruinRaw?.capital_stress_figure, {
          title: "Capital Stress Profile",
          type: "bar",
          note: "Ruin visualization reflects available survivability assumptions and should be interpreted with position-sizing context.",
        }),
        interpretation: {
          title: "Ruin interpretation",
          summary: statusText(statusByDiagnostic.get("ruin"), "Ruin diagnostics estimate survivability under current risk assumptions.", "Ruin diagnostics are limited; assumptions remain thin and should not be over-interpreted."),
        },
      },
    },
    engine_payload: {
      summary_metrics: globalSummaryMetrics,
      diagnostics: envelopeByDiagnostic,
      report_sections: {
        assumptions: getStringArray(reportRaw, ["assumptions", "methodology_assumptions"]),
        limitations: getStringArray(reportRaw, ["limitations"]),
        recommendations: getStringArray(reportRaw, ["recommendations"]),
      },
      raw_result: engine as unknown as Record<string, unknown>,
    },
    report: {
      report_id: `${analysisId}-report`,
      generated_at: now,
      executive_summary: engine.report?.executive_summary ?? engine.summary?.short_summary ?? eligibility.summary_text,
      diagnostics_summary: reportDiagnosticRows,
      methodology_assumptions: [
        ...(engine.report?.methodology_assumptions ?? []),
        ...getStringArray(reportRaw, ["assumptions", "methodology_assumptions"]),
        `engine=${engineContext.engine_name}`,
        `seam=${engineContext.seam}`,
        `artifact_richness=${parsedArtifact.richness}`,
        ...(parsedArtifact.parser_notes?.map((note) => `parser_note=${note}`) ?? []),
      ],
      recommendations: engine.report?.recommendations ?? getStringArray(reportRaw, ["recommendations", "next_steps"]).concat([
        "Review limited/skipped diagnostics before deployment decisions.",
        "Use tighter sizing policies when Monte Carlo tail or ruin estimates remain elevated.",
      ]),
      export_ready: Boolean(engine.report?.export_ready && statusByDiagnostic.get("report") === "available"),
    },
    access: {
      can_view_stability: statusByDiagnostic.get("stability") === "available",
      can_view_regimes: statusByDiagnostic.get("regimes") === "available",
      can_view_ruin: statusByDiagnostic.get("ruin") !== "unavailable" && statusByDiagnostic.get("ruin") !== "skipped",
      can_export_report: Boolean(engine.report?.export_ready && statusByDiagnostic.get("report") === "available"),
    },
  };

  return analysisRecordSchema.parse(record);
}
