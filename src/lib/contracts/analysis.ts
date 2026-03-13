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
}

export interface OverviewDiagnostic {
  metrics: ScoreBand[];
  figure: FigurePayload;
  interpretation: InterpretationBlockPayload;
  verdict: Verdict;
}

export interface DistributionDiagnostic {
  metrics: ScoreBand[];
  figures: FigurePayload[];
  interpretation: InterpretationBlockPayload;
}

export interface MonteCarloDiagnostic {
  metrics: ScoreBand[];
  figure: FigurePayload;
  interpretation: InterpretationBlockPayload;
  warnings: WarningItem[];
}

export interface StabilityDiagnostic {
  metrics: ScoreBand[];
  figure?: FigurePayload;
  interpretation: InterpretationBlockPayload;
  locked?: boolean;
}

export interface ExecutionScenario {
  name: string;
  assumption: string;
  impact: string;
}

export interface ExecutionDiagnostic {
  metrics: ScoreBand[];
  scenarios: ExecutionScenario[];
  figure?: FigurePayload;
  interpretation: InterpretationBlockPayload;
}

export interface RegimeDiagnostic {
  metrics: ScoreBand[];
  figures?: FigurePayload[];
  interpretation: InterpretationBlockPayload;
  locked?: boolean;
}

export interface RuinAssumption {
  name: string;
  value: string;
}

export interface RuinDiagnostic {
  metrics: ScoreBand[];
  assumptions: RuinAssumption[];
  figure?: FigurePayload;
  interpretation: InterpretationBlockPayload;
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
  report: ReportPayload;
  access: AccessFlags;
}
