import { randomUUID } from "node:crypto";
import { analysisRecordSchema, type AnalysisRecord, type ScoreBand } from "@/lib/contracts";
import type { EngineCapabilityProfile, EngineRunContext, EngineAnalysisResult } from "@/lib/server/engine/engine-types";
import type { ParsedArtifact, UploadEligibilitySummary } from "@/lib/server/ingestion";

const DIAGNOSTICS = ["overview", "distribution", "monte_carlo", "stability", "execution", "regimes", "ruin", "report"] as const;
type DiagnosticName = (typeof DIAGNOSTICS)[number];

type FinalStatus = "available" | "limited" | "unavailable" | "skipped";

function score(label: string, value: string, band: ScoreBand["band"]): ScoreBand {
  return { label, value, band };
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

  const warnings = [
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

  const robustness = engine.summary?.robustness_score;
  const overfit = engine.summary?.overfitting_risk_pct;

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
      execution_model: statusByDiagnostic.get("execution") === "available" ? "Execution assumptions supplied" : "Execution assumptions limited",
      monte_carlo: statusByDiagnostic.get("monte_carlo") === "available" ? "Engine-backed monte carlo" : "Monte Carlo degraded by eligibility/capability",
      risk_model: "bulletproof_bt normalized seam",
      notes: [eligibility.summary_text, ...engineContext.degradation_reasons].filter(Boolean).join(" | "),
    },
    summary: {
      robustness_score: score("Robustness Score", robustness !== undefined ? `${Math.round(robustness)} / 100` : "Unavailable", robustness !== undefined ? "good" : "informational"),
      overfitting_risk: score("Overfitting Risk", overfit !== undefined ? `${Math.round(overfit)}%` : "Unavailable", overfit !== undefined ? "elevated" : "informational"),
      execution_resilience: score("Execution Resilience", statusByDiagnostic.get("execution") ?? "unavailable", statusByDiagnostic.get("execution") === "available" ? "moderate" : "informational"),
      headline_verdict: {
        status: engine.summary?.verdict ?? (parsedArtifact.richness === "research_complete" ? "moderate" : "fragile"),
        title: "Engine-backed analysis complete",
        summary: engine.summary?.short_summary ?? eligibility.summary_text,
      },
      short_summary: engine.summary?.short_summary ?? "Analysis generated through bulletproof_bt seam with eligibility-aware reconciliation.",
      key_findings: engine.summary?.key_findings?.length ? engine.summary.key_findings : [`${eligibility.diagnostics_available.length} diagnostics eligible at upload inspection.`],
      warnings,
    },
    diagnostics: {
      overview: {
        metrics: [score("Trade Count", `${parsedArtifact.trades.length}`, "informational")],
        figure: { figure_id: randomUUID(), title: "Overview", type: "line", series: [] },
        interpretation: { title: "Overview", summary: statusByDiagnostic.get("overview") === "available" ? "Overview computed by engine." : "Overview is constrained by upload eligibility or engine capability." },
        verdict: { status: engine.summary?.verdict ?? "moderate", title: "Overview verdict", summary: engine.summary?.short_summary ?? "See report for current limitations." },
      },
      distribution: { metrics: [], figures: [], interpretation: { title: "Distribution", summary: statusByDiagnostic.get("distribution") === "available" ? "Distribution computed by engine." : "Distribution unavailable or limited." } },
      monte_carlo: { metrics: [], figure: { figure_id: randomUUID(), title: "Monte Carlo", type: "fan", series: [] }, interpretation: { title: "Monte Carlo", summary: statusByDiagnostic.get("monte_carlo") === "available" ? "Monte Carlo computed by engine." : "Monte Carlo unavailable or degraded." }, warnings },
      stability: { metrics: [], interpretation: { title: "Stability", summary: statusByDiagnostic.get("stability") === "available" ? "Stability computed by engine." : "Stability unavailable, limited, or skipped." }, locked: statusByDiagnostic.get("stability") !== "available" },
      execution: { metrics: [], scenarios: [], interpretation: { title: "Execution", summary: statusByDiagnostic.get("execution") === "available" ? "Execution sensitivity computed by engine." : "Execution sensitivity limited by available assumptions." } },
      regimes: { metrics: [], interpretation: { title: "Regimes", summary: statusByDiagnostic.get("regimes") === "available" ? "Regime analysis computed by engine." : "Regime diagnostic unavailable, limited, or skipped." }, locked: statusByDiagnostic.get("regimes") !== "available" },
      ruin: { metrics: [], assumptions: [], interpretation: { title: "Ruin", summary: statusByDiagnostic.get("ruin") === "available" ? "Ruin analysis computed by engine." : "Ruin estimate unavailable or limited." } },
    },
    report: {
      report_id: `${analysisId}-report`,
      generated_at: now,
      executive_summary: engine.report?.executive_summary ?? eligibility.summary_text,
      diagnostics_summary: DIAGNOSTICS.filter((name) => statusByDiagnostic.get(name) === "available"),
      methodology_assumptions: [
        ...(engine.report?.methodology_assumptions ?? []),
        `engine=${engineContext.engine_name}`,
        `seam=${engineContext.seam}`,
      ],
      recommendations: engine.report?.recommendations ?? ["Review limited/skipped diagnostics before making deployment decisions."],
      export_ready: Boolean(engine.report?.export_ready),
    },
    access: {
      can_view_stability: statusByDiagnostic.get("stability") === "available",
      can_view_regimes: statusByDiagnostic.get("regimes") === "available",
      can_view_ruin: statusByDiagnostic.get("ruin") !== "unavailable" && statusByDiagnostic.get("ruin") !== "skipped",
      can_export_report: Boolean(engine.report?.export_ready),
    },
  };

  return analysisRecordSchema.parse(record);
}
