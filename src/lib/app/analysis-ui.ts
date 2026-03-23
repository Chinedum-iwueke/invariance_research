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


export function toInterpretationBlockPayload(payload: { title: string; summary: string; bullets?: string[] }) {
  return { title: payload.title, body: payload.summary, bullets: payload.bullets };
}
