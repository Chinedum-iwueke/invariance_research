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

function getArrayItem(source: UnknownRecord | undefined, key: string, index: number): unknown {
  if (!source) return undefined;
  const value = source[key];
  return Array.isArray(value) ? value[index] : undefined;
}

function normalizeText(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function normalizeMetric(metric: unknown, index: number): AnalysisRecord["engine_payload"]["summary_metrics"][number] | undefined {
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

function parseNumericText(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/[%,$]/g, "").trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function classifyExecutionScenario(expectancy: number | undefined, edgeDecayPct: number | undefined) {
  if (expectancy !== undefined && expectancy < 0) return "negative" as const;
  if (edgeDecayPct !== undefined && edgeDecayPct >= 70) return "fragile" as const;
  if (expectancy !== undefined && expectancy >= 0) return "survives" as const;
  return "informational" as const;
}

function classifySensitivity(stressedExpectancy: number | undefined, edgeDecayPct: number | undefined) {
  if (stressedExpectancy !== undefined && stressedExpectancy < 0) return "cost_killed" as const;
  if (edgeDecayPct !== undefined && edgeDecayPct >= 70) return "fragile" as const;
  if (stressedExpectancy !== undefined && stressedExpectancy >= 0) return "resilient" as const;
  return "informational" as const;
}

function toPct(value: number | undefined, digits = 1) {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return `${value.toFixed(digits)}%`;
}

function extractRegimeRows(raw: UnknownRecord | undefined, envelope: AnalysisRecord["engine_payload"]["diagnostics"]["regimes"] | undefined) {
  const candidates: unknown[] = [];
  if (Array.isArray(raw?.regime_metrics)) candidates.push(...raw.regime_metrics);
  if (Array.isArray(raw?.regime_table)) candidates.push(...raw.regime_table);
  if (Array.isArray(raw?.by_regime)) candidates.push(...raw.by_regime);
  if (Array.isArray(raw?.regimes)) candidates.push(...raw.regimes);
  if (Array.isArray(envelope?.metadata?.regime_metrics)) candidates.push(...(envelope.metadata.regime_metrics as unknown[]));

  return candidates
    .map((row) => {
      const entry = asRecord(row);
      if (!entry) return undefined;
      const regimeName = getString(entry, ["regime_name", "regime", "name", "label", "bucket"]);
      if (!regimeName) return undefined;

      const tradeCount = getNumber(entry, ["trade_count", "trades", "n_trades", "count"]);
      const expectancy = getNumber(entry, ["expectancy", "expectancy_r", "expectancyR", "avg_return", "average_return"]);
      const winRate = getNumber(entry, ["win_rate", "win_rate_pct", "winRate", "winRatePct"]);
      const drawdown = getNumber(entry, ["drawdown", "max_drawdown", "max_drawdown_pct", "maxDrawdownPct"]);

      return {
        regime_name: regimeName,
        trade_count: getString(entry, ["trade_count_text", "trade_count_display"]) ?? (tradeCount === undefined ? undefined : `${Math.round(tradeCount)}`),
        expectancy: getString(entry, ["expectancy_text", "expectancy_display"]) ?? (expectancy === undefined ? undefined : formatNumber(expectancy, 4)),
        win_rate:
          getString(entry, ["win_rate_text", "win_rate_display"])
          ?? (winRate === undefined ? undefined : winRate <= 1 ? toPct(winRate * 100) : toPct(winRate)),
        drawdown:
          getString(entry, ["drawdown_text", "drawdown_display"])
          ?? (drawdown === undefined ? undefined : drawdown <= 1 ? toPct(Math.abs(drawdown) * 100) : toPct(Math.abs(drawdown))),
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

function classifyRegimeDependence(
  raw: UnknownRecord | undefined,
  envelope: AnalysisRecord["engine_payload"]["diagnostics"]["regimes"] | undefined,
  regimeRows: Array<{ expectancy?: string }>,
) {
  const emitted = getString(raw, ["classification", "regime_classification", "regime_dependence"])
    ?? (typeof envelope?.metadata?.classification === "string" ? envelope.metadata.classification : undefined)
    ?? (typeof envelope?.metadata?.regime_dependence === "string" ? envelope.metadata.regime_dependence : undefined);

  if (emitted) {
    const normalized = emitted.toLowerCase().replace(/[-\s]+/g, "_");
    if (normalized.includes("fragile")) return "fragile" as const;
    if (normalized.includes("agnostic")) return "regime_agnostic" as const;
    if (normalized.includes("dependent")) return "regime_dependent" as const;
  }

  const expectancies = regimeRows.map((row) => parseNumericText(row.expectancy)).filter((value): value is number => value !== undefined);
  if (expectancies.length < 2) return "informational" as const;
  const min = Math.min(...expectancies);
  const max = Math.max(...expectancies);
  const spread = max - min;
  if (min < 0 && max > 0) return "fragile" as const;
  if (spread > 0.2) return "regime_dependent" as const;
  if (spread <= 0.05) return "regime_agnostic" as const;
  return "informational" as const;
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

function quantile(values: number[], q: number): number | undefined {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(sorted.length - 1, (sorted.length - 1) * q));
  const low = Math.floor(idx);
  const high = Math.ceil(idx);
  if (low === high) return sorted[low];
  const weight = idx - low;
  return sorted[low] * (1 - weight) + sorted[high] * weight;
}

function toDrawdownFraction(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  let normalized = value;
  if (Math.abs(normalized) > 1) normalized /= 100;
  if (normalized > 0) normalized *= -1;
  return normalized;
}

function normalizePercentValue(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return Math.abs(value) <= 1 ? value * 100 : value;
}

function extractDrawdownFractions(monteCarloRaw: UnknownRecord | undefined): number[] {
  if (!monteCarloRaw) return [];

  const candidates: unknown[] = [
    monteCarloRaw.simulated_drawdowns,
    monteCarloRaw.simulatedDrawdowns,
    monteCarloRaw.drawdowns,
    monteCarloRaw.max_drawdowns,
    monteCarloRaw.maxDrawdowns,
    monteCarloRaw.path_drawdowns,
    monteCarloRaw.pathDrawdowns,
    monteCarloRaw.drawdown_samples,
    monteCarloRaw.drawdownSamples,
  ];
  const metadata = asRecord(monteCarloRaw.metadata);
  if (metadata) {
    candidates.push(
      metadata.simulated_drawdowns,
      metadata.simulatedDrawdowns,
      metadata.drawdowns,
      metadata.max_drawdowns,
      metadata.maxDrawdowns,
    );
  }

  const firstArray = candidates.find((entry) => Array.isArray(entry));
  if (!Array.isArray(firstArray)) return [];
  return firstArray
    .map((value) => toDrawdownFraction(value))
    .filter((value): value is number => value !== undefined);
}

function extractInitialEquityFromFanFigure(figure: FigurePayload | undefined): number | undefined {
  if (!figure) return undefined;
  const raw = figure as FigurePayload & UnknownRecord;

  const bands = asRecord(raw.bands);
  if (bands) {
    for (const key of ["p50", "p25", "p75", "p5", "p95"] as const) {
      const values = bands[key];
      if (!Array.isArray(values) || values.length === 0) continue;
      const first = values[0];
      if (typeof first === "number" && Number.isFinite(first)) return first;
    }
  }

  const firstSeriesPoint = figure.series?.[0]?.points?.[0]?.y;
  if (typeof firstSeriesPoint === "number" && Number.isFinite(firstSeriesPoint)) return firstSeriesPoint;
  return undefined;
}

function toFigureSeries(items: unknown): FigurePayload["series"] {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      const entry = asRecord(item);
      const points = Array.isArray(entry?.points)
        ? entry.points
            .map((point, index) => {
              if (Array.isArray(point) && point.length >= 2) {
                const [xRaw, yRaw] = point;
                if ((typeof xRaw !== "number" && typeof xRaw !== "string") || typeof yRaw !== "number" || !Number.isFinite(yRaw)) return undefined;
                return { x: xRaw, y: yRaw };
              }

              const p = asRecord(point);
              const y = typeof p?.y === "number" && Number.isFinite(p.y)
                ? p.y
                : typeof p?.value === "number" && Number.isFinite(p.value)
                  ? p.value
                  : undefined;
              const x = (typeof p?.x === "number" || typeof p?.x === "string")
                ? p.x
                : (typeof p?.label === "string" && p.label.trim().length > 0)
                    ? p.label
                    : index + 1;
              if (y === undefined) return undefined;
              return { x, y };
            })
            .filter((point): point is { x: string | number; y: number } => Boolean(point))
        : [];

      const key = getString(entry, ["key", "id", "series_id", "name"]) ?? `series_${randomUUID()}`;
      const label = getString(entry, ["label", "name", "title"]) ?? key;
      if (!points.length) return undefined;

      const seriesType = getString(entry, ["series_type", "type"]);
      const normalizedType = seriesType === "line" || seriesType === "area" || seriesType === "bar" || seriesType === "scatter" ? seriesType : "line";
      return {
        key,
        label,
        series_type: normalizedType,
        points,
      };
    })
    .filter((entry): entry is FigurePayload["series"][number] => Boolean(entry));
}

function normalizeFigureType(value: string | undefined, fallback: FigurePayload["type"]): FigurePayload["type"] {
  if (!value) return fallback;
  const normalized = value.toLowerCase().trim().replace(/[-\s]+/g, "_");
  if (normalized === "line" || normalized === "line_series") return "line";
  if (normalized === "area" || normalized === "area_series") return "area";
  if (normalized === "bar" || normalized === "bar_chart") return "bar";
  if (normalized === "grouped_bar" || normalized === "bar_groups") return "grouped_bar";
  if (normalized === "histogram") return "histogram";
  if (normalized === "scatter" || normalized === "scatter_plot") return "scatter";
  if (normalized === "fan" || normalized === "fan_chart" || normalized === "fanchart") return "fan_chart";
  if (normalized === "heatmap") return "heatmap";
  if (normalized === "table") return "table";
  return fallback;
}

function mapFigure(payload: unknown, fallback: { title: string; type: FigurePayload["type"]; note: string }): FigurePayload {
  const figure = asRecord(payload);
  const nativeSeries = Array.isArray(figure?.series) ? [...figure.series] : [];
  const nativeLegend = Array.isArray(figure?.legend)
    ? figure.legend
        .map((item) => {
          const legend = asRecord(item);
          const key = getString(legend, ["key"]);
          const label = getString(legend, ["label"]);
          return key && label ? { key, label } : undefined;
        })
        .filter((item): item is { key: string; label: string } => Boolean(item))
    : undefined;

  return {
    ...(figure ?? {}),
    figure_id: getString(figure, ["figure_id", "figureId"]) ?? randomUUID(),
    title: getString(figure, ["title"]) ?? fallback.title,
    subtitle: getString(figure, ["subtitle"]),
    type: normalizeFigureType(getString(figure, ["type", "figure_type", "figureType"]), fallback.type),
    series: nativeSeries.length > 0 ? nativeSeries : toFigureSeries(figure?.series),
    x_label: getString(figure, ["x_label", "xLabel"]),
    y_label: getString(figure, ["y_label", "yLabel"]),
    legend: nativeLegend,
    note: getString(figure, ["note"]) ?? fallback.note,
    provenance: "engine_native",
  };
}

function mapFigureList(payload: unknown, fallback: { title: string; type: FigurePayload["type"]; note: string }): FigurePayload[] {
  if (Array.isArray(payload)) {
    return payload.map((entry) => mapFigure(entry, fallback));
  }
  const single = mapFigure(payload, fallback);
  return [single];
}

function uniqueFigureList(figures: FigurePayload[]): FigurePayload[] {
  const seen = new Set<string>();
  return figures.filter((figure) => {
    const key = figure.figure_id || `${figure.title}-${figure.type}-${figure.series.length}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function pickFigureById(figures: FigurePayload[] | undefined, figureId: string): FigurePayload | undefined {
  if (!figures?.length) return undefined;
  return figures.find((figure) => figure.figure_id.trim().toLowerCase() === figureId.trim().toLowerCase());
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

function deriveBenchmarkStatus(overviewEnvelope: UnknownRecord | undefined): "available" | "unavailable" | "absent" {
  const comparison = asRecord(overviewEnvelope?.benchmark_comparison);
  if (!comparison) return "absent";
  return comparison.available === true ? "available" : "unavailable";
}

function normalizeOverviewBenchmarkComparison(raw: unknown): Record<string, unknown> | undefined {
  const comparison = asRecord(raw);
  if (!comparison) return undefined;

  const available = comparison.available === true;
  const limited = comparison.limited === true;
  const status = available ? "available" : limited ? "limited" : "unavailable";

  return {
    ...comparison,
    status,
  };
}

function envelopeMetricToScore(metric: NonNullable<ReturnType<typeof normalizeMetric>>): ScoreBand {
  const band = metric.band;
  return {
    label: metric.label,
    value: metric.value,
    band: band === "excellent" || band === "good" || band === "moderate" || band === "elevated" || band === "critical" || band === "informational"
      ? band
      : "informational",
  };
}

function extractReportConfidence(report: UnknownRecord | undefined, summary: UnknownRecord | undefined): string | undefined {
  const numeric = getNumber(report, ["confidence", "confidence_pct", "confidencePercent"])
    ?? getNumber(summary, ["confidence", "confidence_pct", "confidencePercent"]);
  if (numeric !== undefined) return `${Math.round(numeric <= 1 ? numeric * 100 : numeric)}%`;
  return getString(report, ["confidence_label", "confidence"]) ?? getString(summary, ["confidence_label", "confidence"]);
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
  const summaryRaw = asRecord(engine.summary);
  const topLevelReportAlias = asRecord((engine as unknown as UnknownRecord).report_payload) ?? asRecord((engine as unknown as UnknownRecord).report);
  const canonicalReport = asRecord(engine.report) ?? reportRaw ?? topLevelReportAlias;
  const reportConfidence = extractReportConfidence(canonicalReport, summaryRaw);
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
  const simulationCount = getNumber(monteCarloRaw, ["simulations", "paths", "n_paths", "num_paths", "simulation_count"]);
  const inferredDrawdownFractions = extractDrawdownFractions(monteCarloRaw);
  const inferredDrawdownPcts = inferredDrawdownFractions.map((value) => value * 100);
  const mcWorst = normalizePercentValue(getNumber(monteCarloRaw, ["worst_drawdown_pct", "worstDrawdownPct"]))
    ?? (inferredDrawdownPcts.length ? Math.min(...inferredDrawdownPcts) : undefined);
  const mcP95 = normalizePercentValue(getNumber(monteCarloRaw, ["p95_drawdown_pct", "drawdown_p95_pct", "p95DrawdownPct"]))
    ?? quantile(inferredDrawdownPcts, 0.95);
  const mcMedian = normalizePercentValue(getNumber(monteCarloRaw, ["median_drawdown_pct", "medianDrawdownPct"]))
    ?? quantile(inferredDrawdownPcts, 0.5);
  const explicitRuinThresholdFraction = getNumber(monteCarloRaw, ["ruin_threshold_fraction", "ruinThresholdFraction"]);
  const explicitRuinThresholdPct = getNumber(monteCarloRaw, ["ruin_threshold_pct", "ruinThresholdPct", "ruin_threshold"]);
  const ruinThresholdFraction = explicitRuinThresholdFraction
    ?? (explicitRuinThresholdPct !== undefined ? explicitRuinThresholdPct / 100 : 0.5);
  const ruinThresholdSource = explicitRuinThresholdFraction !== undefined || explicitRuinThresholdPct !== undefined
    ? "engine_emitted"
    : "default_assumption";
  const derivedRuinProbabilityPct = inferredDrawdownFractions.length
    ? (inferredDrawdownFractions.filter((drawdown) => drawdown <= -ruinThresholdFraction).length / inferredDrawdownFractions.length) * 100
    : undefined;
  const ruinProbability = normalizePercentValue(getNumber(ruinRaw, ["ruin_probability_pct", "ruinProbabilityPct", "probability_of_ruin_pct", "probability_of_ruin", "probabilityOfRuin"]))
    ?? normalizePercentValue(getNumber(monteCarloRaw, ["ruin_probability_pct", "ruinProbabilityPct", "probability_of_ruin", "probabilityOfRuin"]))
    ?? derivedRuinProbabilityPct;
  const baselineExpectancyValue = getNumber(executionRaw, ["baseline_expectancy", "baselineExpectancy"]);
  const stressedExpectancyValue = getNumber(executionRaw, ["stressed_expectancy", "stressedExpectancy"]);
  const edgeDecayPctValue = getNumber(executionRaw, ["edge_decay_pct", "edgeDecayPct", "edge_decay", "edgeDecay"]);
  const executionAssumptions = getStringArray(executionRaw, ["assumptions", "cost_assumptions", "baseline_assumptions"]);
  const executionLimitations = getStringArray(executionRaw, ["limitations", "model_limitations"]);
  const executionRecommendations = getStringArray(executionRaw, ["recommendations", "next_steps"]);
  const executionWarnings = getStringArray(executionRaw, ["warnings"]);

  const verdict = engine.summary?.verdict ?? (robustness !== undefined && robustness >= 70 ? "robust" : robustness !== undefined && robustness >= 50 ? "moderate" : "fragile");

  const reportDiagnosticRows = DIAGNOSTICS.map((name) => `${name}: ${statusByDiagnostic.get(name)}`);
  const statusReasonByDiagnostic = new Map((engine.skipped_diagnostics ?? []).map((item) => [item.diagnostic as DiagnosticName, item.reason]));
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
        benchmark_comparison: asRecord(raw?.benchmark_comparison),
        interpretation,
        assumptions: getStringArray(raw, ["assumptions"]),
        warnings: getStringArray(raw, ["warnings"]),
        recommendations: getStringArray(raw, ["recommendations"]),
        limitations: getStringArray(raw, ["limitations"]),
        metadata: asRecord(raw?.metadata),
      }];
    }),
  ) as AnalysisRecord["engine_payload"]["diagnostics"];
  const mappedOverviewFigure = mapFigure(
    pickFigureById(envelopeByDiagnostic.overview?.figures, "equity_curve")
    ?? envelopeByDiagnostic.overview?.figures[0]
    ?? overviewRaw?.figure
    ?? overviewRaw?.equity_comparison_figure
    ?? getArrayItem(overviewRaw, "figures", 0),
    {
    title: "Equity Comparison",
    type: "line",
    note: statusText(statusByDiagnostic.get("overview"), "Engine-backed series supplied where available.", "Figure is bounded by current artifact richness/capability."),
  });

  const overviewFigureProvenance = mappedOverviewFigure.series.length > 0 ? "engine_emitted" : "reconstructed_from_trades";
  const overviewFigure: FigurePayload = mappedOverviewFigure.series.length > 0
    ? { ...mappedOverviewFigure, title: "Top-line equity view", note: "Engine-emitted overview equity series for top-line review.", provenance: "engine_native" }
    : {
        ...mappedOverviewFigure,
        title: "Top-line equity view",
        note: "Engine overview series unavailable; cumulative PnL was reconstructed from persisted trade-level PnL.",
        series: derivedStats.equitySeries,
        provenance: "reconstructed_from_trades",
      };
  const overviewFigures = uniqueFigureList(
    [overviewFigure, ...(envelopeByDiagnostic.overview?.figures ?? [])],
  );

  if (envelopeByDiagnostic.overview) {
    const benchmarkStatus = deriveBenchmarkStatus(envelopeByDiagnostic.overview as unknown as UnknownRecord);
    envelopeByDiagnostic.overview.metadata = {
      ...(envelopeByDiagnostic.overview.metadata ?? {}),
      overview_figure_provenance: overviewFigureProvenance,
      benchmark_status: benchmarkStatus,
      artifact_richness: parsedArtifact.richness,
      execution_context_level: statusByDiagnostic.get("execution") ?? "limited",
      figure_series_count: overviewFigure.series.length,
    };
  }

  const emittedDistributionFigures = envelopeByDiagnostic.distribution?.figures ?? [];
  const mappedDistributionHistogram = mapFigure(
    pickFigureById(emittedDistributionFigures, "trade_return_histogram")
    ?? emittedDistributionFigures.find((figure) => figure.type === "histogram")
    ?? distributionRaw?.histogram_figure
    ?? distributionRaw?.histogram
    ?? getArrayItem(distributionRaw, "figures", 0),
    {
    title: "Outcome Distribution",
    type: "histogram",
    note: "Distribution histogram shown when engine emits bin data.",
  });
  const distributionHistogramProvenance = mappedDistributionHistogram.series.length > 0 ? "engine_emitted" : "derived_from_persisted_trades";
  const distributionHistogram: FigurePayload = mappedDistributionHistogram.series.length > 0
    ? { ...mappedDistributionHistogram, provenance: "engine_native" }
    : { ...mappedDistributionHistogram, title: "Trade PnL distribution (derived)", note: "Histogram bins were derived from persisted trade-level PnL because engine histogram bins were not emitted.", series: derivedStats.histogramSeries, provenance: "synthesized_fallback" };
  const distributionFigures: FigurePayload[] = emittedDistributionFigures.length > 0
    ? emittedDistributionFigures
    : [
        distributionHistogram,
        mapFigure(distributionRaw?.scatter_figure ?? distributionRaw?.scatter ?? getArrayItem(distributionRaw, "figures", 1), {
          title: "MAE / MFE Behavior",
          type: "scatter",
          note: "Scatter requires excursion fields; absent fields remain intentionally limited.",
        }),
      ].filter((figure) => figure.series.length > 0);
  const monteCarloPrimaryFigure = mapFigure(
    pickFigureById(envelopeByDiagnostic.monte_carlo?.figures, "equity_fan_chart")
    ?? envelopeByDiagnostic.monte_carlo?.figures.find((candidate) => candidate.type === "fan" || candidate.type === "fan_chart")
    ?? envelopeByDiagnostic.monte_carlo?.figures[0]
    ?? monteCarloRaw?.fan_chart_figure
    ?? monteCarloRaw?.figure,
    {
      title: "Monte Carlo Equity Fan",
      type: "fan_chart",
      note: statusText(statusByDiagnostic.get("monte_carlo"), "Fan-chart payload reflects engine-supplied simulation paths.", "Monte Carlo figure is constrained by simulation depth emitted by engine."),
    },
  );
  const monteCarloFigures = uniqueFigureList(
    [monteCarloPrimaryFigure, ...(envelopeByDiagnostic.monte_carlo?.figures ?? [])],
  );
  const executionPrimaryFigure = mapFigure(
    pickFigureById(envelopeByDiagnostic.execution?.figures, "execution_expectancy_decay")
    ?? envelopeByDiagnostic.execution?.figures[0]
    ?? executionRaw?.scenario_figure
    ?? executionRaw?.figure,
    {
      title: "Execution Friction Sensitivity",
      type: "line",
      note: executionAssumptions.length
        ? "Execution scenario chart reflects engine-emitted friction assumptions."
        : "Execution scenario chart is unavailable because stress assumptions were not emitted in this run payload.",
    },
  );
  const executionFigures = uniqueFigureList(
    [executionPrimaryFigure, ...(envelopeByDiagnostic.execution?.figures ?? [])],
  );
  const richDiagnosticsAvailability = [
    `overview=${overviewFigures.length}`,
    `distribution=${distributionFigures.length}`,
    `monte_carlo=${monteCarloFigures.length}`,
    `execution=${executionFigures.length}`,
  ];
  const reportMethodologyAssumptions = [
    ...getStringArray(canonicalReport, ["methodology_assumptions", "assumptions"]),
    ...getStringArray(reportRaw, ["assumptions", "methodology_assumptions"]),
    ...(envelopeByDiagnostic.report?.assumptions ?? []),
    `engine=${engineContext.engine_name}`,
    `seam=${engineContext.seam}`,
    `artifact_richness=${parsedArtifact.richness}`,
    ...richDiagnosticsAvailability,
    ...(parsedArtifact.parser_notes?.map((note) => `parser_note=${note}`) ?? []),
  ].filter((item, idx, arr) => item.length > 0 && arr.indexOf(item) === idx);
  const reportLimitations = [
    ...getStringArray(canonicalReport, ["limitations"]),
    ...getStringArray(reportRaw, ["limitations"]),
    ...(envelopeByDiagnostic.report?.limitations ?? []),
  ].filter((item, idx, arr) => item.length > 0 && arr.indexOf(item) === idx);
  const reportRecommendationsCandidate = [
    ...getStringArray(canonicalReport, ["recommendations", "next_steps"]),
    ...getStringArray(reportRaw, ["recommendations", "next_steps"]),
    ...(envelopeByDiagnostic.report?.recommendations ?? []),
  ].filter((item, idx, arr) => item.length > 0 && arr.indexOf(item) === idx);
  const reportRecommendations = reportRecommendationsCandidate.length
    ? reportRecommendationsCandidate
    : [
        "Review limited/skipped diagnostics before deployment decisions.",
        "Use tighter sizing policies when Monte Carlo tail or ruin estimates remain elevated.",
      ];
  const reportDiagnosticsSummary = [
    ...reportDiagnosticRows,
    ...richDiagnosticsAvailability,
  ];
  const reportFigures = uniqueFigureList(
    [
      ...mapFigureList(canonicalReport?.figures, { title: "Report figure", type: "line", note: "Engine-native report figure payload." }),
      ...(envelopeByDiagnostic.report?.figures ?? []),
      ...overviewFigures,
      ...distributionFigures,
      ...monteCarloFigures,
      ...executionFigures,
    ],
  );

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
    const horizonDays = getNumber(monteCarloRaw, ["horizon_days", "horizonDays", "horizon"]);
    const method = getString(monteCarloRaw, ["method", "sampling_method", "bootstrap_method"]) ?? "bootstrap_iid";
    const ruinThresholdPct = ruinThresholdFraction * 100;
    const initialEquity = extractInitialEquityFromFanFigure(monteCarloPrimaryFigure);
    const ruinThresholdEquity = initialEquity !== undefined ? initialEquity * (1 - ruinThresholdFraction) : undefined;
    const monteCarloAssumptions = envelopeByDiagnostic.monte_carlo.assumptions ?? [];
    if (ruinThresholdSource === "default_assumption") {
      const explicitAssumption = `Default ruin threshold applied at ${(ruinThresholdFraction * 100).toFixed(0)}% drawdown (ruin_threshold_fraction=${ruinThresholdFraction.toFixed(2)}) because no threshold was emitted.`;
      if (!monteCarloAssumptions.includes(explicitAssumption)) {
        envelopeByDiagnostic.monte_carlo.assumptions = [...monteCarloAssumptions, explicitAssumption];
      }
    }
    envelopeByDiagnostic.monte_carlo.metadata = {
      ...(envelopeByDiagnostic.monte_carlo.metadata ?? {}),
      simulations: simulationCount,
      horizon_days: horizonDays,
      method,
      ruin_threshold_pct: ruinThresholdPct,
      ruin_threshold_fraction: ruinThresholdFraction,
      ruin_threshold_equity: ruinThresholdEquity,
      ruin_threshold_source: ruinThresholdSource,
      probability_of_ruin: ruinProbability,
      drawdown_95_pct: mcP95,
      median_drawdown_pct: mcMedian,
      worst_drawdown_pct: mcWorst,
      figure_series_count: envelopeByDiagnostic.monte_carlo.figures?.[0]?.series.length ?? 0,
      has_fan_chart: (envelopeByDiagnostic.monte_carlo.figures?.[0]?.type === "fan" || envelopeByDiagnostic.monte_carlo.figures?.[0]?.type === "fan_chart"),
    };
  }

  const monteCarloRequiredMetrics: ScoreBand[] = [
    score("Worst Simulated Drawdown", formatPct(mcWorst), pctBand(Math.abs(mcWorst ?? 0), 25, 40)),
    score("95th Percentile Drawdown", formatPct(mcP95), pctBand(Math.abs(mcP95 ?? 0), 20, 35)),
    score("Median Drawdown", formatPct(mcMedian), pctBand(Math.abs(mcMedian ?? 0), 12, 25)),
    score("P(Ruin)", formatPct(ruinProbability), pctBand(ruinProbability, 5, 12)),
  ];
  const monteCarloEngineMetrics = (envelopeByDiagnostic.monte_carlo?.summary_metrics ?? []).map(envelopeMetricToScore);
  const monteCarloMetrics = [
    ...monteCarloRequiredMetrics,
    ...monteCarloEngineMetrics.filter((metric) => !monteCarloRequiredMetrics.some((required) => required.label.toLowerCase() === metric.label.toLowerCase())),
  ];

  const regimeRows = extractRegimeRows(regimesRaw, envelopeByDiagnostic.regimes);
  const regimeExpectancies = regimeRows
    .map((row) => parseNumericText(row.expectancy))
    .filter((value): value is number => value !== undefined);
  const bestRegimeFromRows = regimeRows
    .map((row) => ({ name: row.regime_name, expectancy: parseNumericText(row.expectancy) }))
    .filter((row): row is { name: string; expectancy: number } => row.expectancy !== undefined)
    .sort((a, b) => b.expectancy - a.expectancy)[0]?.name;
  const worstRegimeFromRows = regimeRows
    .map((row) => ({ name: row.regime_name, expectancy: parseNumericText(row.expectancy) }))
    .filter((row): row is { name: string; expectancy: number } => row.expectancy !== undefined)
    .sort((a, b) => a.expectancy - b.expectancy)[0]?.name;
  const dominantRegimeFromRows = regimeRows
    .map((row) => ({ name: row.regime_name, trades: parseNumericText(row.trade_count) ?? 0 }))
    .sort((a, b) => b.trades - a.trades)[0]?.name;
  const regimeDispersionFromRows = regimeExpectancies.length > 1
    ? formatNumber(Math.max(...regimeExpectancies) - Math.min(...regimeExpectancies), 4)
    : undefined;
  const regimeThresholdsFromMetadata = Array.isArray(envelopeByDiagnostic.regimes?.metadata?.thresholds)
    ? envelopeByDiagnostic.regimes.metadata.thresholds.filter((item): item is string => typeof item === "string")
    : undefined;

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
        status: statusByDiagnostic.get("overview"),
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
        figures: overviewFigures,
        benchmark_comparison: normalizeOverviewBenchmarkComparison(envelopeByDiagnostic.overview?.benchmark_comparison),
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
        assumptions: envelopeByDiagnostic.overview?.assumptions ?? [],
        limitations: envelopeByDiagnostic.overview?.limitations ?? [],
        recommendations: envelopeByDiagnostic.overview?.recommendations ?? [],
      },
      distribution: {
        status: statusByDiagnostic.get("distribution"),
        metrics: envelopeByDiagnostic.distribution?.summary_metrics.length
          ? envelopeByDiagnostic.distribution.summary_metrics.map(envelopeMetricToScore)
          : [
          score("Expectancy", getString(distributionRaw, ["expectancy", "expectancy_r", "expectancyR"]) ?? formatNumber(derivedStats.expectancy, 4), "moderate"),
          score("Win Rate", formatPct(getNumber(distributionRaw, ["win_rate_pct", "winRatePct"]) ?? derivedStats.winRatePct), pctBand(getNumber(distributionRaw, ["win_rate_pct", "winRatePct"]) ?? derivedStats.winRatePct, 45, 60)),
          score("Median Return", getString(distributionRaw, ["median_return", "median_r", "medianReturn"]) ?? formatNumber(derivedStats.medianPnl, 4), "informational"),
          score("Mean Duration", getString(distributionRaw, ["mean_duration", "meanDuration", "avg_duration"]) ?? formatDuration(derivedStats.avgDurationSeconds), "informational"),
        ],
        figures: distributionFigures,
        interpretation: {
          title: "Distribution interpretation",
          summary: statusText(statusByDiagnostic.get("distribution"), "Distribution metrics describe trade behavior, expectancy shape, and duration structure.", "Distribution view is limited by available artifact fields."),
          bullets: statusByDiagnostic.get("distribution") === "available" ? ["Expectancy and win-rate are engine-derived.", "Duration and dispersion are presented without overclaiming missing MAE/MFE fields."] : ["Upload lacked richer excursion context for full behavior decomposition."],
        },
        assumptions: envelopeByDiagnostic.distribution?.assumptions ?? [],
        limitations: envelopeByDiagnostic.distribution?.limitations ?? [],
        recommendations: envelopeByDiagnostic.distribution?.recommendations ?? [],
        metadata: envelopeByDiagnostic.distribution?.metadata,
      },
      monte_carlo: {
        status: statusByDiagnostic.get("monte_carlo"),
        metrics: monteCarloMetrics,
        figure: monteCarloPrimaryFigure,
        figures: monteCarloFigures,
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
        assumptions: envelopeByDiagnostic.monte_carlo?.assumptions ?? [],
        limitations: envelopeByDiagnostic.monte_carlo?.limitations ?? [],
        recommendations: envelopeByDiagnostic.monte_carlo?.recommendations ?? [],
        metadata: envelopeByDiagnostic.monte_carlo?.metadata,
      },
      stability: {
        status: statusByDiagnostic.get("stability"),
        metrics: envelopeByDiagnostic.stability?.summary_metrics.length
          ? envelopeByDiagnostic.stability.summary_metrics.map(envelopeMetricToScore)
          : [score("Stability Coverage", statusByDiagnostic.get("stability") ?? "unavailable", statusByDiagnostic.get("stability") === "available" ? "moderate" : "informational")],
        figure: envelopeByDiagnostic.stability?.figures[0],
        interpretation: {
          title: "Stability interpretation",
          summary: statusText(statusByDiagnostic.get("stability"), "Stability proxy is provided from available sensitivity outputs.", "Parameter-surface topology is not fully available for this run; interpretation remains limited."),
          bullets: getString(stabilityRaw, ["limitation_note", "note"]) ? [getString(stabilityRaw, ["limitation_note", "note"]) as string] : undefined,
        },
        assumptions: envelopeByDiagnostic.stability?.assumptions ?? [],
        limitations: envelopeByDiagnostic.stability?.limitations ?? [],
        recommendations: envelopeByDiagnostic.stability?.recommendations ?? [],
        metadata: envelopeByDiagnostic.stability?.metadata,
        locked: statusByDiagnostic.get("stability") !== "available",
      },
      execution: {
        status: statusByDiagnostic.get("execution"),
        metrics: envelopeByDiagnostic.execution?.summary_metrics.length
          ? envelopeByDiagnostic.execution.summary_metrics.map(envelopeMetricToScore)
          : [
          score("Baseline Expectancy", getString(executionRaw, ["baseline_expectancy", "baselineExpectancy"]) ?? formatNumber(baselineExpectancyValue, 4), "moderate"),
          score("Stressed Expectancy", getString(executionRaw, ["stressed_expectancy", "stressedExpectancy"]) ?? formatNumber(stressedExpectancyValue, 4), "elevated"),
          score("Edge Decay", getString(executionRaw, ["edge_decay", "edgeDecay"]) ?? (edgeDecayPctValue === undefined ? "Unavailable" : `${edgeDecayPctValue.toFixed(1)}%`), "elevated"),
        ],
        scenarios: Array.isArray(executionRaw?.scenarios)
          ? executionRaw.scenarios
              .map((item) => {
                const scenario = asRecord(item);
                const name = getString(scenario, ["name"]);
                const spread = getString(scenario, ["spread", "spread_bps", "spread_assumption", "spreadAssumption"]);
                const slippage = getString(scenario, ["slippage", "slippage_bps", "slippage_assumption", "slippageAssumption"]);
                const fee = getString(scenario, ["fee", "fees", "fee_bps", "fee_assumption", "feeAssumption"]);
                const expectancyValue = getNumber(scenario, ["expectancy", "expectancy_r", "expectancyR"]);
                const edgeDecayValue = getNumber(scenario, ["edge_decay_pct", "edgeDecayPct", "edge_decay", "edgeDecay"]);
                const expectancy = getString(scenario, ["expectancy_text", "expectancy_display"]) ?? formatNumber(expectancyValue, 4);
                const edgeDecayPct = getString(scenario, ["edge_decay_text", "edge_decay_display"]) ?? (edgeDecayValue === undefined ? undefined : `${edgeDecayValue.toFixed(1)}%`);
                const assumption = getString(scenario, ["assumption", "cost_assumptions"])
                  ?? [spread ? `spread ${spread}` : undefined, slippage ? `slippage ${slippage}` : undefined, fee ? `fee ${fee}` : undefined].filter(Boolean).join(", ");
                const impact = getString(scenario, ["impact", "impact_summary"])
                  ?? (expectancy !== "Unavailable" ? `Expectancy ${expectancy}` : edgeDecayPct ? `Edge decay ${edgeDecayPct}` : undefined);
                if (!name) return undefined;
                return {
                  name,
                  assumption: assumption || "Assumptions not emitted",
                  impact: impact || "Impact not emitted",
                  spread,
                  slippage,
                  fee,
                  expectancy: expectancy === "Unavailable" ? undefined : expectancy,
                  edge_decay_pct: edgeDecayPct,
                  classification: classifyExecutionScenario(expectancyValue, edgeDecayValue),
                };
              })
              .filter((item): item is NonNullable<typeof item> => Boolean(item))
          : [],
        figure: executionPrimaryFigure,
        figures: executionFigures,
        interpretation: {
          title: "Execution interpretation",
          summary: statusText(
            statusByDiagnostic.get("execution"),
            `Baseline expectancy ${formatNumber(baselineExpectancyValue, 4)} moved to ${formatNumber(stressedExpectancyValue, 4)} under stress, with edge decay ${edgeDecayPctValue === undefined ? "Unavailable" : `${edgeDecayPctValue.toFixed(1)}%`}.`,
            "Execution diagnostic is limited because trade-level cost assumptions were incomplete for this run."
          ),
          bullets: [
            `Survivability classification: ${classifySensitivity(stressedExpectancyValue, edgeDecayPctValue).replace("_", " ")}.`,
            `Dominant cost driver: ${getString(executionRaw, ["dominant_cost_driver", "dominantCostDriver"]) ?? "not emitted by engine"}.`,
          ],
        },
        assumptions: envelopeByDiagnostic.execution?.assumptions.length ? envelopeByDiagnostic.execution.assumptions : executionAssumptions,
        limitations: envelopeByDiagnostic.execution?.limitations.length
          ? envelopeByDiagnostic.execution.limitations
          : executionLimitations.length
            ? executionLimitations
            : executionWarnings,
        recommendations: envelopeByDiagnostic.execution?.recommendations.length ? envelopeByDiagnostic.execution.recommendations : executionRecommendations,
        execution_model: getString(executionRaw, ["execution_model", "model"]) ?? (statusByDiagnostic.get("execution") === "available" ? "baseline" : "proxy"),
        stress_realism: getString(executionRaw, ["stress_realism", "realism_level"]) ?? (statusByDiagnostic.get("execution") === "available" ? "moderate" : "limited"),
        artifact_completeness: getString(executionRaw, ["artifact_completeness", "artifact_quality"]) ?? parsedArtifact.richness,
        sensitivity_classification: classifySensitivity(stressedExpectancyValue, edgeDecayPctValue),
      },
      regimes: {
        status: statusByDiagnostic.get("regimes"),
        metrics: envelopeByDiagnostic.regimes?.summary_metrics.length
          ? envelopeByDiagnostic.regimes.summary_metrics.map(envelopeMetricToScore)
          : [score("Regime Diagnostic Status", statusByDiagnostic.get("regimes") ?? "unavailable", statusByDiagnostic.get("regimes") === "available" ? "moderate" : "informational")],
        regime_metrics: regimeRows,
        figures: [
          mapFigure(regimesRaw?.regime_bar_figure ?? regimesRaw?.figure, {
            title: "Performance by Regime",
            type: "bar",
            note: "Regime performance chart is emitted only from available market context and is not backfilled with proxy calculations.",
          }),
          ...(envelopeByDiagnostic.regimes?.figures ?? []),
        ],
        interpretation: {
          title: "Regime interpretation",
          summary: statusText(statusByDiagnostic.get("regimes"), "Regime-aware behavior is reported from emitted trend/volatility classifications.", "Regime analysis is intentionally limited without market context artifacts (OHLCV or explicit regime labels)."),
        },
        assumptions: envelopeByDiagnostic.regimes?.assumptions.length ? envelopeByDiagnostic.regimes.assumptions : getStringArray(regimesRaw, ["assumptions", "methodology_assumptions"]),
        limitations: envelopeByDiagnostic.regimes?.limitations.length
          ? envelopeByDiagnostic.regimes.limitations
          : getStringArray(regimesRaw, ["limitations", "warnings"]),
        recommendations: envelopeByDiagnostic.regimes?.recommendations.length
          ? envelopeByDiagnostic.regimes.recommendations
          : getStringArray(regimesRaw, ["recommendations", "next_steps"]),
        summary_metrics: {
          best_regime:
            getString(regimesRaw, ["best_regime", "best_bucket", "best_regime_name"])
            ?? (typeof envelopeByDiagnostic.regimes?.metadata?.best_regime === "string" ? envelopeByDiagnostic.regimes.metadata.best_regime : undefined)
            ?? bestRegimeFromRows,
          worst_regime:
            getString(regimesRaw, ["worst_regime", "worst_bucket", "worst_regime_name"])
            ?? (typeof envelopeByDiagnostic.regimes?.metadata?.worst_regime === "string" ? envelopeByDiagnostic.regimes.metadata.worst_regime : undefined)
            ?? worstRegimeFromRows,
          regime_dispersion:
            getString(regimesRaw, ["regime_dispersion", "expectancy_dispersion", "dispersion"])
            ?? (typeof envelopeByDiagnostic.regimes?.metadata?.regime_dispersion === "string" ? envelopeByDiagnostic.regimes.metadata.regime_dispersion : undefined)
            ?? regimeDispersionFromRows,
          dominant_regime:
            getString(regimesRaw, ["dominant_regime", "dominant_bucket"])
            ?? (typeof envelopeByDiagnostic.regimes?.metadata?.dominant_regime === "string" ? envelopeByDiagnostic.regimes.metadata.dominant_regime : undefined)
            ?? dominantRegimeFromRows,
        },
        definition: {
          trend_method:
            getString(regimesRaw, ["trend_method", "trend_model", "trend_definition"])
            ?? (typeof envelopeByDiagnostic.regimes?.metadata?.trend_method === "string" ? envelopeByDiagnostic.regimes.metadata.trend_method : undefined),
          volatility_method:
            getString(regimesRaw, ["volatility_method", "vol_method", "vol_definition"])
            ?? (typeof envelopeByDiagnostic.regimes?.metadata?.volatility_method === "string" ? envelopeByDiagnostic.regimes.metadata.volatility_method : undefined),
          thresholds:
            (() => {
              const emitted = getStringArray(regimesRaw, ["thresholds", "regime_thresholds"]);
              if (emitted.length) return emitted;
              return regimeThresholdsFromMetadata;
            })(),
          notes:
            getString(regimesRaw, ["regime_definition", "definition", "notes"])
            ?? (typeof envelopeByDiagnostic.regimes?.metadata?.definition === "string" ? envelopeByDiagnostic.regimes.metadata.definition : undefined),
        },
        classification: classifyRegimeDependence(
          regimesRaw,
          envelopeByDiagnostic.regimes,
          regimeRows,
        ),
        locked: statusByDiagnostic.get("regimes") !== "available",
      },
      ruin: {
        status: statusByDiagnostic.get("ruin"),
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
        figure: mapFigure(
          pickFigureById(envelopeByDiagnostic.ruin?.figures, "ruin_probability_curve")
          ?? envelopeByDiagnostic.ruin?.figures?.[0]
          ?? ruinRaw?.figure
          ?? ruinRaw?.capital_stress_figure,
          {
          title: "Capital Stress Profile",
          type: "bar",
          note: "Ruin visualization reflects available survivability assumptions and should be interpreted with position-sizing context.",
        }),
        interpretation: {
          title: "Ruin interpretation",
          summary: statusText(statusByDiagnostic.get("ruin"), "Ruin diagnostics estimate survivability under current risk assumptions.", "Ruin diagnostics are limited; assumptions remain thin and should not be over-interpreted."),
        },
        limitations: envelopeByDiagnostic.ruin?.limitations ?? [],
        recommendations: envelopeByDiagnostic.ruin?.recommendations ?? [],
        metadata: envelopeByDiagnostic.ruin?.metadata,
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
      executive_summary: getString(canonicalReport, ["executive_summary", "summary"])
        ?? getString(reportRaw, ["executive_summary", "summary", "interpretation", "narrative"])
        ?? envelopeByDiagnostic.report?.interpretation
        ?? engine.summary?.short_summary
        ?? eligibility.summary_text,
      diagnostics_summary: reportDiagnosticsSummary,
      methodology_assumptions: reportMethodologyAssumptions,
      limitations: reportLimitations,
      recommendations: reportRecommendations,
      confidence: reportConfidence,
      verdict,
      deployment_guidance: [
        ...getStringArray(canonicalReport, ["deployment_guidance", "deployment_recommendations", "deployment_conditions"]),
        ...getStringArray(reportRaw, ["deployment_guidance", "deployment_recommendations", "deployment_conditions"]),
      ].filter((item, idx, arr) => item.length > 0 && arr.indexOf(item) === idx),
      figures: reportFigures,
      source: asRecord(engine.report) ? "engine_report" : reportRaw ? "report_diagnostic_alias" : "summary_fallback",
      export_ready: Boolean(canonicalReport?.export_ready === true || getString(canonicalReport, ["export_ready"]) === "true") && statusByDiagnostic.get("report") === "available",
    },
    access: {
      can_view_stability: statusByDiagnostic.get("stability") === "available",
      can_view_regimes: statusByDiagnostic.get("regimes") === "available",
      can_view_ruin: statusByDiagnostic.get("ruin") !== "unavailable" && statusByDiagnostic.get("ruin") !== "skipped",
      can_export_report: Boolean(canonicalReport?.export_ready === true && statusByDiagnostic.get("report") === "available"),
    },
    diagnostic_statuses: Object.fromEntries(
      DIAGNOSTICS.map((name) => {
        const status = statusByDiagnostic.get(name) ?? "unavailable";
        return [name, {
          status,
          available: status === "available",
          limited: status === "limited",
          unavailable: status === "unavailable",
          skipped: status === "skipped",
          reason: statusReasonByDiagnostic.get(name),
        }];
      }),
    ) as AnalysisRecord["diagnostic_statuses"],
  };

  return analysisRecordSchema.parse(record);
}
