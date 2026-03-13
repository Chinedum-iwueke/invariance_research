import { randomUUID } from "node:crypto";
import { analysisRecordSchema, type AnalysisRecord } from "@/lib/contracts";
import type { ParsedArtifact, UploadEligibilitySummary } from "@/lib/server/ingestion";

function toScore(label: string, value: string, band: "excellent" | "good" | "moderate" | "elevated" | "critical" | "informational") {
  return { label, value, band };
}

export function normalizeAnalysisRecord(params: {
  analysisId: string;
  parsedArtifact: ParsedArtifact;
  eligibility: UploadEligibilitySummary;
}): AnalysisRecord {
  const { analysisId, parsedArtifact, eligibility } = params;
  const now = new Date().toISOString();
  const first = parsedArtifact.trades[0];
  const last = parsedArtifact.trades[parsedArtifact.trades.length - 1];
  const strategyName = parsedArtifact.strategy_metadata?.strategy_name ?? first?.strategy_name ?? `Upload ${analysisId.slice(0, 8)}`;

  const record: AnalysisRecord = {
    analysis_id: analysisId,
    status: "completed",
    created_at: now,
    updated_at: now,
    strategy: {
      strategy_name: strategyName,
      symbols: Array.from(new Set(parsedArtifact.trades.map((trade) => trade.symbol))).slice(0, 8),
      timeframe: parsedArtifact.strategy_metadata?.strategy_name ?? first?.timeframe,
      source_type: "upload",
      asset_class: first?.market,
      description: `Artifact classified as ${parsedArtifact.richness}.`,
    },
    dataset: {
      market: first?.market,
      broker_or_exchange: first?.exchange,
      start_date: first?.entry_time,
      end_date: last?.exit_time,
      trade_count: parsedArtifact.trades.length,
      currency: "USD",
    },
    run_context: {
      execution_model: eligibility.diagnostics_limited.includes("execution")
        ? "Limited execution assumptions available"
        : "Execution context supplied",
      monte_carlo: "Transitional in-process Monte Carlo placeholder",
      risk_model: "Transitional risk baseline",
      notes: eligibility.summary_text,
    },
    summary: {
      robustness_score: toScore("Robustness Score", parsedArtifact.richness === "research_complete" ? "74 / 100" : "62 / 100", parsedArtifact.richness === "research_complete" ? "good" : "moderate"),
      overfitting_risk: toScore("Overfitting Risk", parsedArtifact.params ? "34%" : "Limited context", parsedArtifact.params ? "elevated" : "informational"),
      execution_resilience: toScore("Execution Resilience", eligibility.diagnostics_limited.includes("execution") ? "Limited" : "Assessed", eligibility.diagnostics_limited.includes("execution") ? "elevated" : "moderate"),
      headline_verdict: {
        status: parsedArtifact.richness === "research_complete" ? "moderate" : "fragile",
        title: parsedArtifact.richness === "research_complete" ? "Research-complete intake processed" : "Partial-context intake processed",
        summary: eligibility.summary_text,
      },
      short_summary: "Phase 4 transitional normalization generated this record through orchestration boundaries.",
      key_findings: [
        `${eligibility.diagnostics_available.length} diagnostics are currently available.`,
        ...eligibility.limitation_reasons.slice(0, 2),
      ],
      warnings: eligibility.limitation_reasons.map((reason, idx) => ({
        code: `ELIGIBILITY_${idx + 1}`,
        severity: "warning" as const,
        title: "Diagnostic limitation",
        message: reason,
      })),
    },
    diagnostics: {
      overview: {
        metrics: [toScore("Trades", `${parsedArtifact.trades.length}`, "informational")],
        figure: { figure_id: randomUUID(), title: "Overview placeholder", type: "line", series: [] },
        interpretation: { title: "Overview interpretation", summary: "Transitional placeholder output." },
        verdict: { status: "moderate", title: "Transitional result", summary: "Full engine wiring arrives with bulletproof_bt integration." },
      },
      distribution: { metrics: [], figures: [], interpretation: { title: "Distribution", summary: "Placeholder" } },
      monte_carlo: { metrics: [], figure: { figure_id: randomUUID(), title: "Monte Carlo placeholder", type: "fan", series: [] }, interpretation: { title: "Monte Carlo", summary: "Placeholder" }, warnings: [] },
      stability: { metrics: [], interpretation: { title: "Stability", summary: "Availability reflects artifact richness." }, locked: eligibility.diagnostics_unavailable.includes("stability") },
      execution: { metrics: [], scenarios: [], interpretation: { title: "Execution", summary: "Availability reflects provided assumptions." } },
      regimes: { metrics: [], interpretation: { title: "Regimes", summary: "Availability reflects market context." }, locked: eligibility.diagnostics_unavailable.includes("regimes") },
      ruin: { metrics: [], assumptions: [], interpretation: { title: "Ruin", summary: "Placeholder" } },
    },
    report: {
      report_id: `${analysisId}-report`,
      generated_at: now,
      executive_summary: eligibility.summary_text,
      diagnostics_summary: eligibility.diagnostics_available,
      methodology_assumptions: ["Transitional in-process execution model"],
      recommendations: ["Re-run after full bulletproof_bt integration for production analytics."],
      export_ready: false,
    },
    access: {
      can_view_stability: !eligibility.diagnostics_unavailable.includes("stability"),
      can_view_regimes: !eligibility.diagnostics_unavailable.includes("regimes"),
      can_view_ruin: !eligibility.diagnostics_unavailable.includes("ruin"),
      can_export_report: false,
    },
  };

  return analysisRecordSchema.parse(record);
}
