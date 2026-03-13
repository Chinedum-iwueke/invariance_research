import type { AnalysisRecord, AnalysisStatus, InterpretationBlockPayload, ScoreBand } from "@/lib/contracts";
import { analysisRecordSchema } from "@/lib/contracts";

export interface InsightPoint {
  title: string;
  body: string;
  tone?: "info" | "warning" | "critical" | "success";
}

export interface AnalysisTableRow {
  analysis_id: string;
  strategy_name: string;
  trade_count: number;
  timeframe: string;
  asset: string;
  created_at: string;
  status: AnalysisStatus;
  robustness_score: string;
}

const scoreToneMap: Record<ScoreBand["band"], "neutral" | "positive" | "negative" | "warning"> = {
  excellent: "positive",
  good: "positive",
  moderate: "neutral",
  elevated: "warning",
  critical: "negative",
  informational: "neutral",
};

export interface KeyMetric {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "negative" | "warning";
  helper?: string;
}

const baseAnalysisRecords: AnalysisRecord[] = [
  {
    analysis_id: "alpha-trend-v2",
    status: "completed",
    created_at: "2026-03-10",
    updated_at: "2026-03-12",
    strategy: {
      strategy_name: "Alpha Trend v2",
      strategy_type: "Trend Following",
      asset_class: "Equities",
      symbols: ["SPY", "QQQ", "IWM"],
      timeframe: "2019-01 → 2025-12",
      direction: "long_short",
      source_type: "upload",
      description: "Systematic cross-asset trend strategy with volatility-scaled exposure.",
    },
    dataset: {
      market: "US Equities",
      broker_or_exchange: "NASDAQ/NYSE",
      start_date: "2019-01-01",
      end_date: "2025-12-31",
      trade_count: 1862,
      bar_count: 48750,
      currency: "USD",
    },
    run_context: {
      execution_model: "Variable spread + slippage model calibrated by volatility bucket",
      monte_carlo: "10,000 path perturbation with sequence reshuffling and bootstrapped tails",
      risk_model: "Volatility-targeted sizing with hard drawdown circuit breaker",
      notes: "Baseline assumptions aligned to production broker fill quality from 2024 sample.",
    },
    summary: {
      robustness_score: { label: "Robustness Score", value: "72 / 100", band: "good" },
      overfitting_risk: { label: "Overfitting Risk", value: "31%", band: "elevated" },
      execution_resilience: { label: "Execution Resilience", value: "Moderate", band: "moderate" },
      regime_dependence: { label: "Regime Dependence", value: "Elevated", band: "elevated" },
      capital_survivability: { label: "Capital Survivability", value: "Constrained", band: "moderate" },
      headline_verdict: {
        status: "moderate",
        title: "Moderate robustness with friction-driven fragility",
        summary: "Deploy with conservative sizing and explicit execution controls.",
      },
      short_summary: "Edge persists under moderate stress but weakens in adverse execution and regime drift.",
      key_findings: [
        "Tail risk remains material under adverse sequencing.",
        "Edge durability depends on slippage containment.",
        "Regime-aware deployment filters are recommended.",
      ],
      warnings: [
        {
          code: "EXEC_DRIFT",
          severity: "warning",
          title: "Execution drift risk",
          message: "Execution drift in high-volatility windows can materially reduce edge.",
        },
        {
          code: "MC_TAIL",
          severity: "critical",
          title: "Tail drawdown concentration",
          message: "Worst-case Monte Carlo paths imply significant capital impairment risk.",
        },
      ],
    },
    diagnostics: {
      overview: {
        metrics: [
          { label: "Robustness Score", value: "72 / 100", band: "good" },
          { label: "Overfitting Risk", value: "31%", band: "elevated" },
          { label: "Worst Monte Carlo Drawdown", value: "-38.4%", band: "critical" },
          { label: "Risk-of-Ruin Probability", value: "6.2%", band: "elevated" },
        ],
        figure: {
          figure_id: "overview-equity-panel",
          title: "Equity Comparison Panel",
          subtitle: "Historical equity, median Monte Carlo path, and worst simulated path",
          type: "line",
          series: [],
          legend: [
            { key: "historical", label: "Historical Equity" },
            { key: "median", label: "Median Monte Carlo" },
            { key: "worst", label: "Worst Simulated Path" },
          ],
          note: "Figure shell is chart-ready and will receive backend series payloads in Phase 5.",
        },
        interpretation: {
          title: "Overview interpretation",
          summary:
            "Robustness remains moderate, but overfitting and tail-risk indicators suggest cautious deployment.",
          bullets: [
            "Overfitting risk is elevated relative to institutional tolerance.",
            "Worst-case stress suggests meaningful capital impairment risk.",
            "Execution-aware constraints should be enforced before scaling.",
          ],
        },
        verdict: {
          status: "moderate",
          title: "Moderate robustness with fragility under friction",
          summary: "Deploy only with conservative sizing, stricter execution controls, and periodic parameter drift review.",
        },
      },
      distribution: {
        metrics: [
          { label: "Median R-Multiple", value: "0.18R", band: "moderate" },
          { label: "Win Rate", value: "53.4%", band: "good" },
          { label: "Avg Duration", value: "2.6 days", band: "informational" },
          { label: "Right-tail Concentration", value: "High", band: "elevated" },
        ],
        figures: [
          { figure_id: "dist-r", title: "R-Multiple Distribution", subtitle: "Outcome dispersion by trade", type: "histogram", series: [] },
          { figure_id: "dist-mae-mfe", title: "MAE / MFE Scatter", subtitle: "Excursion profile", type: "scatter", series: [] },
          { figure_id: "dist-duration", title: "Trade Duration Distribution", subtitle: "Holding-period behavior", type: "histogram", series: [] },
        ],
        interpretation: {
          title: "Distribution interpretation",
          summary:
            "Edge quality is right-tail dependent, indicating sensitivity to execution quality and regime context.",
          bullets: ["Distribution tails drive cumulative expectancy.", "Median trade quality is modest relative to top decile."],
        },
      },
      monte_carlo: {
        metrics: [
          { label: "Worst Simulated Drawdown", value: "-38.4%", band: "critical" },
          { label: "95th Percentile Drawdown", value: "-29.1%", band: "elevated" },
          { label: "Median Drawdown", value: "-14.7%", band: "moderate" },
          { label: "P(30% Drawdown)", value: "12.8%", band: "elevated" },
          { label: "P(50% Drawdown)", value: "2.1%", band: "critical" },
          { label: "P(Ruin)", value: "6.2%", band: "elevated" },
        ],
        figure: {
          figure_id: "mc-fan",
          title: "Monte Carlo Equity Fan",
          subtitle: "Simulated paths with median and worst-case trajectories",
          type: "fan",
          series: [],
          legend: [
            { key: "path", label: "Simulation Paths" },
            { key: "median", label: "Median Path" },
            { key: "worst", label: "Worst Path" },
          ],
        },
        interpretation: {
          title: "Monte Carlo Interpretation",
          summary:
            "Tail risk remains significant; severe path realizations imply deep impairment risk without strict controls.",
          bullets: [
            "Probability of 30% drawdown is high enough to influence deployment policy.",
            "Ruin probability is non-zero and must be sized against capital mandate.",
            "Consider analyst-led stress extension before larger allocation.",
          ],
        },
        warnings: [
          {
            code: "MC_RUIN",
            severity: "warning",
            title: "Ruin risk above baseline threshold",
            message: "Ruin probability is above institutional comfort thresholds for initial deployment.",
          },
        ],
      },
      stability: {
        metrics: [{ label: "Stability Surface Coverage", value: "Premium", band: "informational" }],
        interpretation: {
          title: "Stability diagnostics",
          summary: "Advanced stability diagnostics are available in premium tier.",
        },
        locked: true,
      },
      execution: {
        metrics: [
          { label: "Baseline Net CAGR", value: "14.2%", band: "good" },
          { label: "+50% Slippage", value: "8.1%", band: "elevated" },
          { label: "+100% Slippage", value: "3.9%", band: "critical" },
          { label: "Edge Collapse Threshold", value: "1.9x costs", band: "elevated" },
        ],
        scenarios: [
          { name: "Baseline", assumption: "Observed 2024 costs", impact: "14.2% Net CAGR" },
          { name: "Friction Stress", assumption: "+50% slippage", impact: "8.1% Net CAGR" },
          { name: "Adverse Stress", assumption: "+100% slippage", impact: "3.9% Net CAGR" },
        ],
        interpretation: {
          title: "Execution interpretation",
          summary: "Expected edge degrades quickly as friction assumptions worsen.",
          bullets: [
            "Cost inflation above threshold materially compresses edge.",
            "Execution conditions should be monitored as deployment gate.",
          ],
        },
      },
      regimes: {
        metrics: [
          { label: "High-Vol Regime", value: "Strong", band: "good" },
          { label: "Low-Vol Regime", value: "Weak", band: "elevated" },
          { label: "Strong Trend", value: "Outperforms", band: "good" },
          { label: "Choppy Regime", value: "Underperforms", band: "critical" },
        ],
        figures: [
          { figure_id: "regime-vol", title: "Performance by Volatility Regime", subtitle: "Low/medium/high-vol behavior", type: "bar", series: [] },
          { figure_id: "regime-trend", title: "Performance by Trend Strength", subtitle: "Trend/chop segmentation", type: "bar", series: [] },
        ],
        interpretation: {
          title: "Regime interpretation",
          summary: "Strategy efficacy clusters in high-volatility trend environments and degrades in choppy states.",
          bullets: [
            "Avoid deployment during low-volatility chop states.",
            "Scale exposure only when trend-strength criteria are met.",
          ],
        },
        locked: true,
      },
      ruin: {
        metrics: [
          { label: "Account Size", value: "$250,000", band: "informational" },
          { label: "Risk per Trade", value: "0.75%", band: "informational" },
          { label: "Probability of Ruin", value: "6.2%", band: "elevated" },
          { label: "Worst Expected Drawdown", value: "-34.8%", band: "critical" },
        ],
        assumptions: [
          { name: "Account Size", value: "$250,000" },
          { name: "Risk per Trade", value: "0.75%" },
        ],
        interpretation: {
          title: "Ruin interpretation",
          summary: "Current ruin probability is elevated for institutional tolerance.",
          bullets: ["Capital survivability is sensitive to position sizing.", "Stress outcomes warrant tighter loss controls."],
        },
      },
    },
    report: {
      report_id: "alpha-trend-v2-report",
      generated_at: "2026-03-12",
      executive_summary:
        "Alpha Trend v2 demonstrates moderate robustness with identifiable fragility under execution stress and regime drift.",
      diagnostics_summary: [
        "Distribution tails drive expectancy.",
        "Monte Carlo stress highlights meaningful tail risk.",
        "Execution costs are a major fragility driver.",
      ],
      methodology_assumptions: [
        "Transaction costs modeled with variable spread and slippage bands.",
        "Trade-sequence perturbations applied through Monte Carlo stress.",
        "Regime decomposition by volatility and trend-strength proxies.",
      ],
      recommendations: [
        "Use conservative position sizing until further stability validation.",
        "Monitor execution drift in high-volatility windows.",
        "Escalate to independent audit for governance-critical mandates.",
      ],
      export_ready: false,
    },
    access: {
      can_view_stability: false,
      can_view_regimes: false,
      can_view_ruin: true,
      can_export_report: false,
    },
  },
  {
    analysis_id: "fx-meanrev-core",
    status: "processing",
    created_at: "2026-03-08",
    updated_at: "2026-03-12",
    strategy: { strategy_name: "FX Mean Reversion Core", symbols: ["EURUSD", "USDJPY"], timeframe: "2018-01 → 2025-12", source_type: "upload" },
    dataset: { market: "G10 FX", trade_count: 932, currency: "USD" },
    run_context: { execution_model: "Pending", monte_carlo: "Pending", risk_model: "Pending" },
    summary: {
      headline_verdict: { status: "moderate", title: "Analysis in progress", summary: "Backend processing is still running." },
      short_summary: "Processing run.",
      key_findings: [],
      warnings: [],
    },
    diagnostics: {
      overview: { metrics: [], figure: { figure_id: "pending", title: "Pending", type: "line", series: [] }, interpretation: { title: "Pending", summary: "Pending" }, verdict: { status: "moderate", title: "Pending", summary: "Pending" } },
      distribution: { metrics: [], figures: [], interpretation: { title: "Pending", summary: "Pending" } },
      monte_carlo: { metrics: [], figure: { figure_id: "pending", title: "Pending", type: "fan", series: [] }, interpretation: { title: "Pending", summary: "Pending" }, warnings: [] },
      stability: { metrics: [], interpretation: { title: "Pending", summary: "Pending" }, locked: true },
      execution: { metrics: [], scenarios: [], interpretation: { title: "Pending", summary: "Pending" } },
      regimes: { metrics: [], interpretation: { title: "Pending", summary: "Pending" }, locked: true },
      ruin: { metrics: [], assumptions: [], interpretation: { title: "Pending", summary: "Pending" } },
    },
    report: {
      report_id: "fx-meanrev-core-report",
      executive_summary: "Report pending analysis completion.",
      diagnostics_summary: [],
      methodology_assumptions: [],
      recommendations: [],
      export_ready: false,
    },
    access: { can_view_stability: false, can_view_regimes: false, can_view_ruin: false, can_export_report: false },
  },
];

export const analysisRecords = baseAnalysisRecords.map((record) => analysisRecordSchema.parse(record));

export const analysisLibrary: AnalysisTableRow[] = analysisRecords.map((record) => ({
  analysis_id: record.analysis_id,
  strategy_name: record.strategy.strategy_name,
  trade_count: record.dataset.trade_count,
  timeframe: record.strategy.timeframe ?? "N/A",
  asset: record.dataset.market ?? record.strategy.asset_class ?? "N/A",
  created_at: record.created_at,
  status: record.status,
  robustness_score: record.summary.robustness_score?.value ?? "N/A",
}));

export function getAnalysisRecord(id: string): AnalysisRecord {
  return analysisRecords.find((record) => record.analysis_id === id) ?? analysisRecords[0];
}

export function getAnalysisContext(id: string) {
  const record = getAnalysisRecord(id);
  return {
    analysis_id: record.analysis_id,
    strategy_name: record.strategy.strategy_name,
    trade_count: record.dataset.trade_count,
    timeframe: record.strategy.timeframe ?? "N/A",
    asset: record.dataset.market ?? "N/A",
    analysis_status: record.status,
    robustness_score: record.summary.robustness_score?.value ?? "N/A",
    warnings: record.summary.warnings.map((item) => item.message),
  };
}

export type AnalysisContext = ReturnType<typeof getAnalysisContext>;

function mapMetrics(metrics: ScoreBand[], helperMap?: Record<string, string>): KeyMetric[] {
  return metrics.map((metric) => ({
    label: metric.label,
    value: metric.value,
    tone: scoreToneMap[metric.band],
    helper: helperMap?.[metric.label],
  }));
}

export const reportSections = [
  { title: "Executive Summary", href: "/app/analyses/alpha-trend-v2/overview" },
  { title: "Distribution Diagnostics", href: "/app/analyses/alpha-trend-v2/distribution" },
  { title: "Monte Carlo Stress", href: "/app/analyses/alpha-trend-v2/monte-carlo" },
  { title: "Execution Sensitivity", href: "/app/analyses/alpha-trend-v2/execution" },
  { title: "Regime Dependency", href: "/app/analyses/alpha-trend-v2/regimes" },
] as const;

const primary = getAnalysisRecord("alpha-trend-v2");

export const overviewDiagnostic = primary.diagnostics.overview;
export const overviewMetrics = mapMetrics(primary.diagnostics.overview.metrics, {
  "Robustness Score": "Moderate institutional readiness",
  "Overfitting Risk": "Parameter concentration detected",
  "Worst Monte Carlo Drawdown": "Tail stress scenario",
  "Risk-of-Ruin Probability": "At baseline sizing policy",
});
export const monteCarloStats = mapMetrics(primary.diagnostics.monte_carlo.metrics);
export const distributionStats = mapMetrics(primary.diagnostics.distribution.metrics);
export const executionStats = mapMetrics(primary.diagnostics.execution.metrics);
export const regimeStats = mapMetrics(primary.diagnostics.regimes.metrics);
export const ruinStats = mapMetrics(primary.diagnostics.ruin.metrics);

export function toInterpretationBlockPayload(payload: InterpretationBlockPayload): { title: string; body: string; bullets?: string[] } {
  return { title: payload.title, body: payload.summary, bullets: payload.bullets };
}
