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
    type: (getString(figure, ["type"]) as FigurePayload["type"] | undefined) ?? fallback.type,
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
  const overviewRaw = pickFirstRecord(diagnostics, ["overview"]);
  const distributionRaw = pickFirstRecord(diagnostics, ["distribution"]);
  const monteCarloRaw = pickFirstRecord(diagnostics, ["monte_carlo", "monteCarlo"]);
  const executionRaw = pickFirstRecord(diagnostics, ["execution"]);
  const regimesRaw = pickFirstRecord(diagnostics, ["regimes"]);
  const ruinRaw = pickFirstRecord(diagnostics, ["ruin"]);
  const stabilityRaw = pickFirstRecord(diagnostics, ["stability"]);
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

  const robustness = engine.summary?.robustness_score ?? getNumber(overviewRaw, ["robustness_score", "robustnessScore", "score"]);
  const overfit = engine.summary?.overfitting_risk_pct ?? getNumber(overviewRaw, ["overfitting_risk_pct", "overfittingRiskPct"]);
  const mcWorst = getNumber(monteCarloRaw, ["worst_drawdown_pct", "worstDrawdownPct"]);
  const mcP95 = getNumber(monteCarloRaw, ["p95_drawdown_pct", "drawdown_p95_pct", "p95DrawdownPct"]);
  const mcMedian = getNumber(monteCarloRaw, ["median_drawdown_pct", "medianDrawdownPct"]);
  const ruinProbability = getNumber(ruinRaw, ["ruin_probability_pct", "ruinProbabilityPct", "probability_of_ruin_pct"])
    ?? getNumber(monteCarloRaw, ["ruin_probability_pct", "ruinProbabilityPct"]);

  const verdict = engine.summary?.verdict ?? (robustness !== undefined && robustness >= 70 ? "robust" : robustness !== undefined && robustness >= 50 ? "moderate" : "fragile");

  const reportDiagnosticRows = DIAGNOSTICS.map((name) => `${name}: ${statusByDiagnostic.get(name)}`);
  const mappedOverviewFigure = mapFigure(overviewRaw?.figure ?? overviewRaw?.equity_comparison_figure, {
    title: "Equity Comparison",
    type: "line",
    note: statusText(statusByDiagnostic.get("overview"), "Engine-backed series supplied where available.", "Figure is bounded by current artifact richness/capability."),
  });

  const overviewFigure: FigurePayload = mappedOverviewFigure.series.length > 0
    ? mappedOverviewFigure
    : { ...mappedOverviewFigure, title: "Derived cumulative PnL", note: "Engine did not emit overview chart series; a cumulative PnL curve was reconstructed from persisted trade-level PnL.", series: derivedStats.equitySeries };

  const mappedDistributionHistogram = mapFigure(distributionRaw?.histogram_figure ?? distributionRaw?.histogram, {
    title: "Outcome Distribution",
    type: "histogram",
    note: "Distribution histogram shown when engine emits bin data.",
  });
  const distributionHistogram: FigurePayload = mappedDistributionHistogram.series.length > 0
    ? mappedDistributionHistogram
    : { ...mappedDistributionHistogram, title: "Trade PnL distribution (derived)", note: "Histogram bins were derived from persisted trade-level PnL because engine histogram bins were not emitted.", series: derivedStats.histogramSeries };

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
        metrics: [
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
          summary: statusText(
            statusByDiagnostic.get("overview"),
            "Top-line diagnostics combine robustness, overfitting, Monte Carlo tail stress, and ruin sensitivity.",
            "Overview is available with bounded depth due to upload richness and engine capability limits.",
          ),
          bullets: [
            ...(engine.summary?.key_findings ?? []).slice(0, 3),
            ...warnings.slice(0, 2).map((warning) => warning.message),
          ].slice(0, 4),
        },
        verdict: { status: verdict, title: "Overview verdict", summary: engine.summary?.short_summary ?? "See report for current limitations and assumptions." },
      },
      distribution: {
        metrics: [
          score("Expectancy", getString(distributionRaw, ["expectancy", "expectancy_r", "expectancyR"]) ?? formatNumber(derivedStats.expectancy, 4), "moderate"),
          score("Win Rate", formatPct(getNumber(distributionRaw, ["win_rate_pct", "winRatePct"]) ?? derivedStats.winRatePct), pctBand(getNumber(distributionRaw, ["win_rate_pct", "winRatePct"]) ?? derivedStats.winRatePct, 45, 60)),
          score("Median Return", getString(distributionRaw, ["median_return", "median_r", "medianReturn"]) ?? formatNumber(derivedStats.medianPnl, 4), "informational"),
          score("Mean Duration", getString(distributionRaw, ["mean_duration", "meanDuration", "avg_duration"]) ?? formatDuration(derivedStats.avgDurationSeconds), "informational"),
        ],
        figures: [
          distributionHistogram,
          mapFigure(distributionRaw?.scatter_figure ?? distributionRaw?.scatter, { title: "MAE / MFE Behavior", type: "scatter", note: "Scatter requires excursion fields; absent fields remain intentionally limited." }),
        ],
        interpretation: {
          title: "Distribution interpretation",
          summary: statusText(statusByDiagnostic.get("distribution"), "Distribution metrics describe trade behavior, expectancy shape, and duration structure.", "Distribution view is limited by available artifact fields."),
          bullets: statusByDiagnostic.get("distribution") === "available" ? ["Expectancy and win-rate are engine-derived.", "Duration and dispersion are presented without overclaiming missing MAE/MFE fields."] : ["Upload lacked richer excursion context for full behavior decomposition."],
        },
      },
      monte_carlo: {
        metrics: [
          score("Worst Simulated Drawdown", formatPct(mcWorst), pctBand(Math.abs(mcWorst ?? 0), 25, 40)),
          score("95th Percentile Drawdown", formatPct(mcP95), pctBand(Math.abs(mcP95 ?? 0), 20, 35)),
          score("Median Drawdown", formatPct(mcMedian), pctBand(Math.abs(mcMedian ?? 0), 12, 25)),
          score("P(Ruin)", formatPct(ruinProbability), pctBand(ruinProbability, 5, 12)),
        ],
        figure: mapFigure(monteCarloRaw?.fan_chart_figure ?? monteCarloRaw?.figure, {
          title: "Monte Carlo Equity Fan",
          type: "fan",
          note: statusText(statusByDiagnostic.get("monte_carlo"), "Fan-chart payload reflects engine-supplied simulation paths.", "Monte Carlo figure is constrained by simulation depth emitted by engine."),
        }),
        interpretation: {
          title: "Monte Carlo interpretation",
          summary: statusText(statusByDiagnostic.get("monte_carlo"), "Simulation outputs provide tail-risk and survivability context under sequence perturbation.", "Monte Carlo diagnostics are available with bounded confidence due to limited assumptions/capability."),
          bullets: [
            `Worst drawdown estimate: ${formatPct(mcWorst)}.`,
            `95th percentile drawdown: ${formatPct(mcP95)}.`,
            `Ruin probability estimate: ${formatPct(ruinProbability)}.`,
          ],
        },
        warnings,
      },
      stability: {
        metrics: [score("Stability Coverage", statusByDiagnostic.get("stability") ?? "unavailable", statusByDiagnostic.get("stability") === "available" ? "moderate" : "informational")],
        interpretation: {
          title: "Stability interpretation",
          summary: statusText(statusByDiagnostic.get("stability"), "Stability proxy is provided from available sensitivity outputs.", "Parameter-surface topology is not fully available for this run; interpretation remains limited."),
          bullets: getString(stabilityRaw, ["limitation_note", "note"]) ? [getString(stabilityRaw, ["limitation_note", "note"]) as string] : undefined,
        },
        locked: statusByDiagnostic.get("stability") !== "available",
      },
      execution: {
        metrics: [
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
        figure: mapFigure(executionRaw?.scenario_figure ?? executionRaw?.figure, {
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
        metrics: [score("Regime Diagnostic Status", statusByDiagnostic.get("regimes") ?? "unavailable", statusByDiagnostic.get("regimes") === "available" ? "moderate" : "informational")],
        figures: [
          mapFigure(regimesRaw?.regime_bar_figure ?? regimesRaw?.figure, {
            title: "Regime Proxy Summary",
            type: "bar",
            note: "Regime figures are shown as proxy summaries unless richer OHLCV regime context is supplied.",
          }),
        ],
        interpretation: {
          title: "Regime interpretation",
          summary: statusText(statusByDiagnostic.get("regimes"), "Regime-aware behavior is reported from available context.", "Regime analysis is intentionally limited without richer market-state context (e.g., OHLCV/regime labels)."),
        },
        locked: statusByDiagnostic.get("regimes") !== "available",
      },
      ruin: {
        metrics: [
          score("Probability of Ruin", formatPct(ruinProbability), pctBand(ruinProbability, 5, 12)),
          score("Expected Stress Drawdown", formatPct(getNumber(ruinRaw, ["stress_drawdown_pct", "stressDrawdownPct"])), pctBand(Math.abs(getNumber(ruinRaw, ["stress_drawdown_pct", "stressDrawdownPct"]) ?? 0), 25, 40)),
        ],
        assumptions: [
          { name: "Artifact Richness", value: parsedArtifact.richness },
          { name: "Trade Count", value: `${parsedArtifact.trades.length}` },
        ],
        figure: mapFigure(ruinRaw?.figure ?? ruinRaw?.capital_stress_figure, {
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
    report: {
      report_id: `${analysisId}-report`,
      generated_at: now,
      executive_summary: engine.report?.executive_summary ?? engine.summary?.short_summary ?? eligibility.summary_text,
      diagnostics_summary: reportDiagnosticRows,
      methodology_assumptions: [
        ...(engine.report?.methodology_assumptions ?? []),
        `engine=${engineContext.engine_name}`,
        `seam=${engineContext.seam}`,
        `artifact_richness=${parsedArtifact.richness}`,
        ...(parsedArtifact.parser_notes?.map((note) => `parser_note=${note}`) ?? []),
      ],
      recommendations: engine.report?.recommendations ?? [
        "Review limited/skipped diagnostics before deployment decisions.",
        "Use tighter sizing policies when Monte Carlo tail or ruin estimates remain elevated.",
      ],
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
