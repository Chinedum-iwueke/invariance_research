import type { AnalysisListItem, AnalysisRecord, AnalysisStatus, ScoreBand } from "@/lib/contracts";

export interface InsightPoint {
  title: string;
  body: string;
  tone?: "info" | "warning" | "critical" | "success";
}

export interface KeyMetric {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "negative" | "warning";
  helper?: string;
}

export interface AnalysisContext {
  analysis_id: string;
  strategy_name: string;
  trade_count: number;
  timeframe: string;
  asset: string;
  analysis_status: AnalysisStatus;
  robustness_score: string;
  warnings: string[];
}

const scoreToneMap: Record<ScoreBand["band"], KeyMetric["tone"]> = {
  excellent: "positive",
  good: "positive",
  moderate: "neutral",
  elevated: "warning",
  critical: "negative",
  informational: "neutral",
};

export function metricsFromScoreBands(metrics: ScoreBand[], helperMap?: Record<string, string>): KeyMetric[] {
  return metrics.map((metric) => ({
    label: metric.label,
    value: metric.value,
    tone: scoreToneMap[metric.band] ?? "neutral",
    helper: helperMap?.[metric.label],
  }));
}

const OVERVIEW_METRIC_PRIORITY: ReadonlyArray<ReadonlyArray<string>> = [
  ["robustness score", "robustness"],
  ["trade count", "trades"],
  ["win rate", "win-rate"],
  ["expectancy", "expected value"],
  ["profit factor", "payoff ratio", "payoff"],
  ["worst monte carlo drawdown", "worst simulated drawdown", "max drawdown", "maximum drawdown", "drawdown"],
  ["risk of ruin", "probability of ruin", "p(ruin)"],
  ["overfitting risk", "overfitting"],
];

const DISTRIBUTION_METRIC_PRIORITY: ReadonlyArray<ReadonlyArray<string>> = [
  ["expectancy", "expected value"],
  ["win rate", "win-rate"],
  ["median return", "median pnl", "median"],
  ["mean return", "average return", "mean pnl", "average pnl"],
  ["profit factor"],
  ["payoff ratio", "payoff"],
  ["trade count", "trades"],
  ["std dev", "standard deviation", "dispersion", "volatility"],
  ["duration", "holding period"],
];

const MONTE_CARLO_METRIC_PRIORITY: ReadonlyArray<ReadonlyArray<string>> = [
  ["worst simulated drawdown", "worst monte carlo drawdown", "max drawdown", "maximum drawdown"],
  ["95th percentile drawdown", "p95 drawdown", "drawdown p95", "95 percentile"],
  ["median drawdown", "drawdown median", "p50 drawdown"],
  ["probability of ruin", "risk of ruin", "p ruin", "p(ruin)"],
];

const EXECUTION_METRIC_PRIORITY: ReadonlyArray<ReadonlyArray<string>> = [
  ["baseline expectancy", "baseline edge", "baseline"],
  ["stressed expectancy", "stress expectancy", "stressed"],
  ["edge decay", "decay", "edge erosion"],
];

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");
}

function isUnavailableValue(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized.length === 0 || ["unavailable", "n/a", "na", "unknown", "not available", "-"].includes(normalized);
}

export function selectOverviewTopMetrics(metrics: ScoreBand[], limit = 6): ScoreBand[] {
  const selected: ScoreBand[] = [];
  const used = new Set<number>();

  const pushMetric = (metric: ScoreBand, idx: number) => {
    if (used.has(idx) || selected.length >= limit) return;
    selected.push(metric);
    used.add(idx);
  };

  OVERVIEW_METRIC_PRIORITY.forEach((aliases) => {
    if (selected.length >= limit) return;
    const preferred = metrics.findIndex((metric, idx) => !used.has(idx) && aliases.some((alias) => normalizeLabel(metric.label).includes(alias)) && !isUnavailableValue(metric.value));
    if (preferred >= 0) pushMetric(metrics[preferred], preferred);
  });

  metrics.forEach((metric, idx) => {
    if (selected.length >= limit || used.has(idx)) return;
    if (!isUnavailableValue(metric.value)) {
      pushMetric(metric, idx);
    }
  });

  metrics.forEach((metric, idx) => {
    if (selected.length >= limit || used.has(idx)) return;
    pushMetric(metric, idx);
  });

  return selected;
}

export function selectDistributionTopMetrics(metrics: ScoreBand[], limit = 4): ScoreBand[] {
  const selected: ScoreBand[] = [];
  const used = new Set<number>();

  const pushMetric = (metric: ScoreBand, idx: number) => {
    if (used.has(idx) || selected.length >= limit) return;
    selected.push(metric);
    used.add(idx);
  };

  DISTRIBUTION_METRIC_PRIORITY.forEach((aliases) => {
    if (selected.length >= limit) return;
    const preferred = metrics.findIndex((metric, idx) => !used.has(idx) && aliases.some((alias) => normalizeLabel(metric.label).includes(alias)) && !isUnavailableValue(metric.value));
    if (preferred >= 0) pushMetric(metrics[preferred], preferred);
  });

  metrics.forEach((metric, idx) => {
    if (selected.length >= limit || used.has(idx)) return;
    if (!isUnavailableValue(metric.value)) pushMetric(metric, idx);
  });

  metrics.forEach((metric, idx) => {
    if (selected.length >= limit || used.has(idx)) return;
    pushMetric(metric, idx);
  });

  return selected;
}

export function selectMonteCarloTopMetrics(metrics: ScoreBand[], limit = 4): ScoreBand[] {
  const selected: ScoreBand[] = [];
  const used = new Set<number>();

  const pushMetric = (metric: ScoreBand, idx: number) => {
    if (used.has(idx) || selected.length >= limit) return;
    selected.push(metric);
    used.add(idx);
  };

  MONTE_CARLO_METRIC_PRIORITY.forEach((aliases) => {
    if (selected.length >= limit) return;
    const preferred = metrics.findIndex((metric, idx) => !used.has(idx) && aliases.some((alias) => normalizeLabel(metric.label).includes(alias)) && !isUnavailableValue(metric.value));
    if (preferred >= 0) pushMetric(metrics[preferred], preferred);
  });

  metrics.forEach((metric, idx) => {
    if (selected.length >= limit || used.has(idx)) return;
    if (!isUnavailableValue(metric.value)) pushMetric(metric, idx);
  });

  metrics.forEach((metric, idx) => {
    if (selected.length >= limit || used.has(idx)) return;
    pushMetric(metric, idx);
  });

  return selected;
}

export function selectExecutionTopMetrics(metrics: ScoreBand[], limit = 3): ScoreBand[] {
  const selected: ScoreBand[] = [];
  const used = new Set<number>();

  const pushMetric = (metric: ScoreBand, idx: number) => {
    if (used.has(idx) || selected.length >= limit) return;
    selected.push(metric);
    used.add(idx);
  };

  EXECUTION_METRIC_PRIORITY.forEach((aliases) => {
    if (selected.length >= limit) return;
    const preferred = metrics.findIndex((metric, idx) => !used.has(idx) && aliases.some((alias) => normalizeLabel(metric.label).includes(alias)));
    if (preferred >= 0) pushMetric(metrics[preferred], preferred);
  });

  metrics.forEach((metric, idx) => {
    if (selected.length >= limit || used.has(idx)) return;
    if (!isUnavailableValue(metric.value)) pushMetric(metric, idx);
  });

  metrics.forEach((metric, idx) => {
    if (selected.length >= limit || used.has(idx)) return;
    pushMetric(metric, idx);
  });

  return selected;
}

export function buildAnalysisContext(analysis: AnalysisListItem, record?: AnalysisRecord): AnalysisContext {
  return {
    analysis_id: analysis.analysis_id,
    strategy_name: analysis.strategy_name,
    trade_count: analysis.trade_count,
    timeframe: analysis.timeframe,
    asset: analysis.asset,
    analysis_status: analysis.status,
    robustness_score: analysis.robustness_score,
    warnings: record?.summary.warnings.map((item) => item.message) ?? [],
  };
}


export function toInterpretationBlockPayload(payload: {
  title: string;
  summary?: string;
  narrative?: string;
  interpretation?: string;
  bullets?: string[];
  positives?: string[];
  cautions?: string[];
  key_caveats?: string[];
  caveats?: string[];
}) {
  return {
    title: payload.title,
    body: payload.summary ?? payload.narrative ?? payload.interpretation ?? "No interpretation summary was emitted for this run.",
    bullets: payload.bullets,
    positives: payload.positives,
    cautions: payload.cautions,
    caveats: payload.key_caveats ?? payload.caveats,
  };
}
