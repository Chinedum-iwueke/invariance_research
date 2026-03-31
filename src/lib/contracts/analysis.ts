import type { FigurePayload } from "@/lib/contracts/figures";
import type { ReportPayload } from "@/lib/contracts/report";

export type AnalysisStatus = "draft" | "uploaded" | "queued" | "processing" | "completed" | "failed";

export interface StrategyMetadata {
  strategy_name: string;
  strategy_type?: string;
  asset_class?: string;
  symbols: string[];
  timeframe?: string;
  direction?: "long" | "short" | "long_short";
  source_type: "upload" | "api" | "manual";
  description?: string;
}

export interface DatasetMetadata {
  market?: string;
  broker_or_exchange?: string;
  start_date?: string;
  end_date?: string;
  trade_count: number;
  bar_count?: number;
  currency?: string;
}

export interface RunContext {
  execution_model: string;
  monte_carlo: string;
  risk_model: string;
  notes?: string;
}

export interface ScoreBand {
  value: string;
  band: "excellent" | "good" | "moderate" | "elevated" | "critical" | "informational";
  label: string;
}

export interface Verdict {
  status: "robust" | "moderate" | "fragile";
  title: string;
  summary: string;
}

export interface WarningItem {
  code: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
}

export interface InterpretationBlockPayload {
  title: string;
  summary: string;
  bullets?: string[];
  positives?: string[];
  cautions?: string[];
  caveats?: string[];
  key_caveats?: string[];
  narrative?: string;
  interpretation?: string;
}

export interface OverviewDiagnostic {
  status?: "available" | "limited" | "unavailable" | "skipped";
  metrics: ScoreBand[];
  figure: FigurePayload;
  figures?: FigurePayload[];
  benchmark_comparison?: Record<string, unknown>;
  interpretation: InterpretationBlockPayload;
  verdict: Verdict;
  assumptions?: string[];
  limitations?: string[];
  recommendations?: string[];
}

export interface DistributionDiagnostic {
  status?: "available" | "limited" | "unavailable" | "skipped";
  metrics: ScoreBand[];
  figures: FigurePayload[];
  interpretation: InterpretationBlockPayload;
  assumptions?: string[];
  limitations?: string[];
  recommendations?: string[];
  metadata?: Record<string, unknown>;
}

export interface MonteCarloDiagnostic {
  status?: "available" | "limited" | "unavailable" | "skipped";
  metrics: ScoreBand[];
  figure: FigurePayload;
  figures?: FigurePayload[];
  interpretation: InterpretationBlockPayload;
  warnings: WarningItem[];
  assumptions?: string[];
  limitations?: string[];
  recommendations?: string[];
  metadata?: Record<string, unknown>;
}

export interface StabilityDiagnostic {
  status?: "available" | "limited" | "unavailable" | "skipped";
  metrics: ScoreBand[];
  figure?: FigurePayload;
  interpretation: InterpretationBlockPayload;
  limitations?: string[];
  assumptions?: string[];
  recommendations?: string[];
  metadata?: Record<string, unknown>;
  locked?: boolean;
}

export interface ExecutionScenario {
  name: string;
  assumption: string;
  impact: string;
  spread?: string;
  slippage?: string;
  fee?: string;
  expectancy?: string;
  edge_decay_pct?: string;
  classification?: "survives" | "fragile" | "negative" | "informational";
}

export interface ExecutionDiagnostic {
  status?: "available" | "limited" | "unavailable" | "skipped";
  metrics: ScoreBand[];
  scenarios: ExecutionScenario[];
  figure?: FigurePayload;
  figures?: FigurePayload[];
  interpretation: InterpretationBlockPayload;
  assumptions?: string[];
  limitations?: string[];
  recommendations?: string[];
  execution_model?: string;
  stress_realism?: string;
  artifact_completeness?: string;
  sensitivity_classification?: "resilient" | "fragile" | "cost_killed" | "informational";
}

export interface RegimeDiagnostic {
  status?: "available" | "limited" | "unavailable" | "skipped";
  metrics: ScoreBand[];
  regime_metrics: RegimeMetricRow[];
  figures?: FigurePayload[];
  interpretation: InterpretationBlockPayload;
  assumptions?: string[];
  limitations?: string[];
  recommendations?: string[];
  summary_metrics?: RegimeSummaryMetrics;
  definition?: RegimeDefinition;
  classification?: "regime_dependent" | "regime_agnostic" | "fragile" | "informational";
  locked?: boolean;
}

export interface RegimeMetricRow {
  regime_name: string;
  trade_count?: string;
  expectancy?: string;
  win_rate?: string;
  drawdown?: string;
}

export interface RegimeSummaryMetrics {
  best_regime?: string;
  worst_regime?: string;
  regime_dispersion?: string;
  dominant_regime?: string;
}

export interface RegimeDefinition {
  trend_method?: string;
  volatility_method?: string;
  thresholds?: string[];
  notes?: string;
}

export interface RuinAssumption {
  name: string;
  value: string;
}

export interface RuinDiagnostic {
  status?: "available" | "limited" | "unavailable" | "skipped";
  metrics: ScoreBand[];
  assumptions: RuinAssumption[];
  figure?: FigurePayload;
  interpretation: InterpretationBlockPayload;
  limitations?: string[];
  recommendations?: string[];
  metadata?: Record<string, unknown>;
}

export interface EngineDiagnosticMetric {
  key: string;
  label: string;
  value: string;
  numeric_value?: number;
  band?: ScoreBand["band"];
}

export interface EngineDiagnosticEnvelope {
  status?: "available" | "limited" | "unavailable" | "skipped";
  summary_metrics: EngineDiagnosticMetric[];
  figures: FigurePayload[];
  benchmark_comparison?: Record<string, unknown>;
  interpretation?: string;
  assumptions: string[];
  warnings: string[];
  recommendations: string[];
  limitations: string[];
  metadata?: Record<string, unknown>;
}

export interface EnginePayloadSnapshot {
  summary_metrics: EngineDiagnosticMetric[];
  diagnostics: Partial<Record<"overview" | "distribution" | "monte_carlo" | "stability" | "execution" | "regimes" | "ruin" | "report", EngineDiagnosticEnvelope>>;
  report_sections: {
    assumptions: string[];
    limitations: string[];
    recommendations: string[];
  };
  raw_result: Record<string, unknown>;
}

export interface DiagnosticBundle {
  overview: OverviewDiagnostic;
  distribution: DistributionDiagnostic;
  monte_carlo: MonteCarloDiagnostic;
  stability: StabilityDiagnostic;
  execution: ExecutionDiagnostic;
  regimes: RegimeDiagnostic;
  ruin: RuinDiagnostic;
}

export interface AccessFlags {
  can_view_stability: boolean;
  can_view_regimes: boolean;
  can_view_ruin: boolean;
  can_export_report: boolean;
}

export interface NormalizedDiagnosticStatus {
  status: "available" | "limited" | "unavailable" | "skipped";
  available: boolean;
  limited: boolean;
  unavailable: boolean;
  skipped: boolean;
  reason?: string;
}

export interface AnalysisSummary {
  robustness_score?: ScoreBand;
  overfitting_risk?: ScoreBand;
  execution_resilience?: ScoreBand;
  regime_dependence?: ScoreBand;
  capital_survivability?: ScoreBand;
  headline_verdict: Verdict;
  short_summary: string;
  key_findings: string[];
  warnings: WarningItem[];
}

export interface AnalysisRecord {
  analysis_id: string;
  status: AnalysisStatus;
  created_at: string;
  updated_at: string;
  strategy: StrategyMetadata;
  dataset: DatasetMetadata;
  run_context: RunContext;
  summary: AnalysisSummary;
  diagnostics: DiagnosticBundle;
  engine_payload: EnginePayloadSnapshot;
  report: ReportPayload;
  access: AccessFlags;
  diagnostic_statuses: Record<"overview" | "distribution" | "monte_carlo" | "stability" | "execution" | "regimes" | "ruin" | "report", NormalizedDiagnosticStatus>;
}
