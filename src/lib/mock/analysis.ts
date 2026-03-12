export type AnalysisStatus = "completed" | "running" | "queued" | "failed";

export interface AnalysisSummary {
  id: string;
  strategy_name: string;
  trade_count: number;
  timeframe: string;
  asset: string;
  created_at: string;
  status: AnalysisStatus;
  robustness_score: number;
}

export interface AnalysisContext {
  id: string;
  strategy_name: string;
  trade_count: number;
  timeframe: string;
  asset: string;
  analysis_status: AnalysisStatus;
  robustness_score: number;
  warnings: string[];
}

export interface KeyMetric {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "negative" | "warning";
  helper?: string;
}

export interface InsightPoint {
  title: string;
  body: string;
  tone?: "info" | "warning" | "critical" | "success";
}

export interface DiagnosticPayload {
  interpretation_points: InsightPoint[];
  verdict: {
    title: string;
    summary: string;
    posture: "robust" | "moderate" | "fragile";
  };
  upgrade_flags?: string[];
}

export const analysisLibrary: AnalysisSummary[] = [
  {
    id: "alpha-trend-v2",
    strategy_name: "Alpha Trend v2",
    trade_count: 1862,
    timeframe: "2019-01 → 2025-12",
    asset: "US Equities",
    created_at: "2026-03-10",
    status: "completed",
    robustness_score: 72,
  },
  {
    id: "fx-meanrev-core",
    strategy_name: "FX Mean Reversion Core",
    trade_count: 932,
    timeframe: "2018-01 → 2025-12",
    asset: "G10 FX",
    created_at: "2026-03-08",
    status: "running",
    robustness_score: 58,
  },
  {
    id: "intraday-breakout-eu",
    strategy_name: "Intraday Breakout EU",
    trade_count: 1271,
    timeframe: "2020-01 → 2025-12",
    asset: "EU Index Futures",
    created_at: "2026-03-06",
    status: "queued",
    robustness_score: 64,
  },
];

export const analysisContextById: Record<string, AnalysisContext> = {
  "alpha-trend-v2": {
    id: "alpha-trend-v2",
    strategy_name: "Alpha Trend v2",
    trade_count: 1862,
    timeframe: "2019-01 → 2025-12",
    asset: "US Equities",
    analysis_status: "completed",
    robustness_score: 72,
    warnings: ["Execution drift in high-volatility windows", "Fragility observed beyond baseline slippage assumptions"],
  },
};

export const overviewMetrics: KeyMetric[] = [
  { label: "Robustness Score", value: "72 / 100", tone: "positive", helper: "Moderate institutional readiness" },
  { label: "Overfitting Risk", value: "31%", tone: "warning", helper: "Parameter concentration detected" },
  { label: "Worst Monte Carlo Drawdown", value: "-38.4%", tone: "negative", helper: "Tail stress scenario" },
  { label: "Risk-of-Ruin Probability", value: "6.2%", tone: "warning", helper: "At baseline sizing policy" },
];

export const overviewDiagnostic: DiagnosticPayload = {
  interpretation_points: [
    { title: "Stability posture", body: "Core edge persists under moderate perturbation, but higher slippage assumptions degrade returns.", tone: "warning" },
    { title: "Tail profile", body: "Worst-case drawdown remains material and should be contextualized with capital controls.", tone: "critical" },
  ],
  verdict: {
    title: "Moderate robustness with fragility under friction",
    summary: "Deploy only with conservative sizing, stricter execution controls, and periodic parameter drift review.",
    posture: "moderate",
  },
  upgrade_flags: ["Unlock advanced regime diagnostics", "Unlock full stability surface"],
};

export const monteCarloStats: KeyMetric[] = [
  { label: "Worst Simulated Drawdown", value: "-38.4%", tone: "negative" },
  { label: "95th Percentile Drawdown", value: "-29.1%", tone: "warning" },
  { label: "Median Drawdown", value: "-14.7%" },
  { label: "P(30% Drawdown)", value: "12.8%", tone: "warning" },
  { label: "P(50% Drawdown)", value: "2.1%", tone: "negative" },
  { label: "P(Ruin)", value: "6.2%", tone: "warning" },
];

export const distributionStats: KeyMetric[] = [
  { label: "Median R-Multiple", value: "0.18R" },
  { label: "Win Rate", value: "53.4%" },
  { label: "Avg Duration", value: "2.6 days" },
  { label: "Right-tail Concentration", value: "High", tone: "warning" },
];

export const executionStats: KeyMetric[] = [
  { label: "Baseline Net CAGR", value: "14.2%" },
  { label: "+50% Slippage", value: "8.1%", tone: "warning" },
  { label: "+100% Slippage", value: "3.9%", tone: "negative" },
  { label: "Edge Collapse Threshold", value: "1.9x costs", tone: "warning" },
];

export const regimeStats: KeyMetric[] = [
  { label: "High-Vol Regime", value: "Strong", tone: "positive" },
  { label: "Low-Vol Regime", value: "Weak", tone: "warning" },
  { label: "Strong Trend", value: "Outperforms", tone: "positive" },
  { label: "Choppy Regime", value: "Underperforms", tone: "negative" },
];

export const ruinStats: KeyMetric[] = [
  { label: "Account Size", value: "$250,000" },
  { label: "Risk per Trade", value: "0.75%" },
  { label: "Probability of Ruin", value: "6.2%", tone: "warning" },
  { label: "Worst Expected Drawdown", value: "-34.8%", tone: "negative" },
];

export const reportSections = [
  { title: "Executive Summary", href: "/app/analyses/alpha-trend-v2/overview" },
  { title: "Distribution Diagnostics", href: "/app/analyses/alpha-trend-v2/distribution" },
  { title: "Monte Carlo Stress", href: "/app/analyses/alpha-trend-v2/monte-carlo" },
  { title: "Execution Sensitivity", href: "/app/analyses/alpha-trend-v2/execution" },
  { title: "Regime Dependency", href: "/app/analyses/alpha-trend-v2/regimes" },
] as const;

export function getAnalysisContext(id: string): AnalysisContext {
  return analysisContextById[id] ?? analysisContextById["alpha-trend-v2"];
}
