import type { AnalysisRecord } from "@/lib/contracts";
import { mapRawMonteCarloToMonteCarloDiagnostic } from "@/lib/server/adapters/bulletproof/map-monte-carlo";
import { mapRawOverviewToOverviewDiagnostic } from "@/lib/server/adapters/bulletproof/map-overview";
import { mapRawReportToReportPayload } from "@/lib/server/adapters/bulletproof/map-report";
import type { RawEngineAnalysisResult } from "@/lib/server/adapters/bulletproof/types";

export function mapRawAnalysisToProductAnalysis(raw: RawEngineAnalysisResult): AnalysisRecord {
  const overview = mapRawOverviewToOverviewDiagnostic(raw.overview);
  const monteCarlo = mapRawMonteCarloToMonteCarloDiagnostic(raw.monteCarlo);

  return {
    analysis_id: raw.runId,
    status: raw.status === "running" ? "processing" : raw.status,
    created_at: raw.createdAt,
    updated_at: raw.updatedAt,
    strategy: {
      strategy_name: raw.strategyName,
      symbols: raw.symbols,
      source_type: "upload",
    },
    dataset: {
      trade_count: raw.tradeCount,
    },
    run_context: {
      execution_model: "Placeholder execution model",
      monte_carlo: "Placeholder monte carlo model",
      risk_model: "Placeholder risk model",
    },
    summary: {
      robustness_score: overview.metrics[0],
      overfitting_risk: overview.metrics[1],
      headline_verdict: overview.verdict,
      short_summary: "Adapter scaffold summary.",
      key_findings: ["Wire bulletproof_bt package outputs into normalized product contracts."],
      warnings: monteCarlo.warnings,
    },
    diagnostics: {
      overview,
      distribution: {
        metrics: [],
        figures: [],
        interpretation: {
          title: "Distribution Interpretation",
          summary: "Placeholder distribution mapping pending backend integration.",
        },
      },
      monte_carlo: monteCarlo,
      stability: {
        metrics: [],
        interpretation: { title: "Stability Interpretation", summary: "Premium diagnostic not yet mapped." },
        locked: true,
      },
      execution: {
        metrics: [],
        scenarios: [],
        interpretation: { title: "Execution Interpretation", summary: "Execution mapping not yet connected." },
      },
      regimes: {
        metrics: [],
        regime_metrics: [],
        interpretation: { title: "Regime Interpretation", summary: "Regime mapping not yet connected." },
        locked: true,
      },
      ruin: {
        metrics: [],
        assumptions: [],
        interpretation: { title: "Ruin Interpretation", summary: "Ruin mapping not yet connected." },
      },
    },
    report: mapRawReportToReportPayload(raw.report, `${raw.runId}-report`),
    engine_payload: {
      summary_metrics: [],
      diagnostics: {},
      report_sections: { assumptions: [], limitations: [], recommendations: [] },
      raw_result: {},
    },
    access: {
      can_view_stability: false,
      can_view_regimes: false,
      can_view_ruin: true,
      can_export_report: false,
    },
    diagnostic_statuses: {
      overview: { status: "available", available: true, limited: false, unavailable: false, skipped: false },
      distribution: { status: "unavailable", available: false, limited: false, unavailable: true, skipped: false },
      monte_carlo: { status: "available", available: true, limited: false, unavailable: false, skipped: false },
      stability: { status: "skipped", available: false, limited: false, unavailable: false, skipped: true },
      execution: { status: "unavailable", available: false, limited: false, unavailable: true, skipped: false },
      regimes: { status: "skipped", available: false, limited: false, unavailable: false, skipped: true },
      ruin: { status: "limited", available: false, limited: true, unavailable: false, skipped: false },
      report: { status: "limited", available: false, limited: true, unavailable: false, skipped: false },
    },
  };
}
