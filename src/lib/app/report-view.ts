import type { AnalysisRecord, FigurePayload, ScoreBand } from "@/lib/contracts";
import { isFigureRenderable } from "@/lib/app/figure-rendering";
import { selectExecutionTopMetrics, selectMonteCarloTopMetrics, selectOverviewTopMetrics, selectRuinTopMetrics } from "@/lib/app/analysis-ui";

export type VerdictPosture = "robust" | "moderate" | "fragile";

export interface ReportVerdictModel {
  posture: VerdictPosture;
  statusLabel: "Robust" | "Conditional" | "Fragile" | "Not deployment-ready";
  headline: string;
  summary: string;
}

export interface ConfidenceModel {
  level: "high" | "medium" | "low";
  label: "High" | "Medium" | "Low";
  value?: string;
  explanation: string;
}

export interface DeploymentGuidanceModel {
  advisable: boolean;
  advisoryLabel: "Deployment Advisable" | "Deployment Not Yet Advisable";
  summary: string;
  suitableContexts: string[];
  requiredConditions: string[];
  blockers: string[];
}

export interface ReportViewModel {
  verdict: ReportVerdictModel;
  confidence: ConfidenceModel;
  keyMetrics: ScoreBand[];
  diagnosticsSummary: string[];
  methodology: string[];
  limitations: string[];
  recommendations: string[];
  deploymentGuidance: DeploymentGuidanceModel;
  charts: FigurePayload[];
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function isUnavailable(value: string | undefined): boolean {
  if (!value) return true;
  const candidate = normalize(value);
  return ["", "unavailable", "n/a", "na", "none", "unknown", "not available", "-"].includes(candidate);
}

function uniqueRows(rows: string[], limit = 8): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const row of rows) {
    const trimmed = row.trim();
    if (!trimmed) continue;
    const key = normalize(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(trimmed);
    if (deduped.length >= limit) break;
  }
  return deduped;
}

export function deriveReportVerdict(record: AnalysisRecord): ReportVerdictModel {
  const status = record.summary.headline_verdict.status;
  const statusLabel = status === "robust"
    ? "Robust"
    : status === "moderate"
      ? "Conditional"
      : (record.diagnostics.ruin.metrics.some((metric) => /probability of ruin|risk of ruin/i.test(metric.label) && !isUnavailable(metric.value) && Number.parseFloat(metric.value) >= 20)
          ? "Not deployment-ready"
          : "Fragile");

  return {
    posture: status,
    statusLabel,
    headline: record.summary.headline_verdict.title,
    summary: record.summary.headline_verdict.summary,
  };
}

export function deriveConfidenceModel(record: AnalysisRecord): ConfidenceModel {
  const totalDiagnostics = ["overview", "distribution", "monte_carlo", "execution", "stability", "regimes", "ruin", "report"] as const;
  const availableCount = totalDiagnostics.filter((key) => record.diagnostic_statuses[key].status === "available").length;
  const richArtifact = record.report.methodology_assumptions.some((item) => /artifact_richness=(institutional|high)/i.test(item));

  const level = availableCount >= 6 && richArtifact
    ? "high"
    : availableCount >= 4
      ? "medium"
      : "low";

  const label = level === "high" ? "High" : level === "medium" ? "Medium" : "Low";
  const value = record.report.confidence;
  const explanation = level === "high"
    ? "Most diagnostics are available with richer artifacts, supporting high-confidence interpretation."
    : level === "medium"
      ? "Core diagnostics are available, but at least one depth diagnostic remains limited or unavailable."
      : "Limited artifact richness or missing diagnostics materially reduce confidence in deployment conclusions.";

  return { level, label, value, explanation };
}

function preferredMetrics(record: AnalysisRecord): ScoreBand[] {
  const metricPool = [
    ...selectOverviewTopMetrics(record.diagnostics.overview.metrics, 4),
    ...selectMonteCarloTopMetrics(record.diagnostics.monte_carlo.metrics, 2),
    ...selectRuinTopMetrics(record.diagnostics.ruin.metrics, 2),
    ...selectExecutionTopMetrics(record.diagnostics.execution.metrics, 2),
  ];

  const seen = new Set<string>();
  const filtered: ScoreBand[] = [];
  for (const metric of metricPool) {
    const key = normalize(metric.label);
    if (seen.has(key) || isUnavailable(metric.value)) continue;
    seen.add(key);
    filtered.push(metric);
    if (filtered.length >= 6) break;
  }

  return filtered.length ? filtered : selectOverviewTopMetrics(record.diagnostics.overview.metrics, 6);
}

function deriveDeploymentGuidance(record: AnalysisRecord, verdict: ReportVerdictModel): DeploymentGuidanceModel {
  const recommendationRows = uniqueRows([
    ...record.report.recommendations,
    ...record.diagnostics.execution.recommendations ?? [],
    ...record.diagnostics.regimes.recommendations ?? [],
  ], 12);

  const limitationRows = uniqueRows([
    ...record.report.limitations,
    ...record.diagnostics.execution.limitations ?? [],
    ...record.diagnostics.regimes.limitations ?? [],
  ], 10);

  const suitableContexts = uniqueRows([
    record.diagnostics.regimes.summary_metrics?.best_regime ? `Best observed regime: ${record.diagnostics.regimes.summary_metrics.best_regime}.` : "",
    record.diagnostics.execution.sensitivity_classification === "resilient" ? "Most appropriate where transaction-cost assumptions remain close to modeled baseline." : "",
    verdict.posture === "robust" ? "Suitable for staged deployment with strict risk controls and ongoing drift monitoring." : "",
  ], 3);

  const requiredConditions = uniqueRows([
    ...recommendationRows.filter((item) => /before|require|must|tight|sizing|monitor|review|validate/i.test(item)),
    "Validate live execution slippage/fees against modeled assumptions before scaling capital.",
    "Apply hard risk limits and stop deployment if expectancy degradation exceeds modeled tolerance.",
  ], 4);

  const blockers = uniqueRows([
    ...limitationRows.filter((item) => /missing|limited|unavailable|thin|not available|insufficient|absent/i.test(item)),
    verdict.statusLabel === "Not deployment-ready" ? "Current survivability profile indicates elevated ruin risk under stress." : "",
    record.diagnostic_statuses.report.status !== "available" ? "Report diagnostic envelope is not fully available." : "",
  ], 4);

  const advisable = verdict.posture === "robust" && blockers.length === 0;

  return {
    advisable,
    advisoryLabel: advisable ? "Deployment Advisable" : "Deployment Not Yet Advisable",
    summary: advisable
      ? "Proceed with phased capital allocation only under documented risk controls and monitoring triggers."
      : "Defer broad deployment until diagnostic gaps and explicit blocker conditions are resolved.",
    suitableContexts,
    requiredConditions,
    blockers,
  };
}

function deriveCuratedCharts(record: AnalysisRecord): FigurePayload[] {
  const candidates: Array<FigurePayload | undefined> = [
    ...record.report.figures,
    ...(record.diagnostics.overview.figures ?? [record.diagnostics.overview.figure]),
    ...record.diagnostics.distribution.figures,
    ...(record.diagnostics.monte_carlo.figures ?? [record.diagnostics.monte_carlo.figure]),
    ...(record.diagnostics.execution.figures ?? [record.diagnostics.execution.figure]).filter(Boolean),
    record.diagnostics.stability.figure,
    ...(record.diagnostics.regimes.figures ?? []),
    record.diagnostics.ruin.figure,
  ];

  const deduped: FigurePayload[] = [];
  const seen = new Set<string>();
  let filteredEmptySeries = 0;
  let filteredDuplicate = 0;
  for (const figure of candidates) {
    if (!figure || !isFigureRenderable(figure)) {
      filteredEmptySeries += 1;
      continue;
    }
    const key = figure.figure_id.trim().toLowerCase();
    if (seen.has(key)) {
      filteredDuplicate += 1;
      continue;
    }
    seen.add(key);
    deduped.push(figure);
  }

  const curated = deduped.slice(0, 8);
  const filteredByCap = Math.max(deduped.length - curated.length, 0);
  console.log("[analysis-page-debug]", {
    scope: "analysis-page-debug",
    analysis_id: record.analysis_id,
    page: "report",
    stage: "derive_curated_charts",
    candidate_count: candidates.length,
    candidate_types: candidates.filter(Boolean).map((figure) => figure?.type ?? "unknown"),
    selected_figure_count: curated.length,
    selected_figure_types: curated.map((figure) => figure.type),
    filtered_empty_or_missing_series_count: filteredEmptySeries,
    filtered_duplicate_count: filteredDuplicate,
    filtered_by_cap_count: filteredByCap,
  });
  return curated;
}

export function buildReportViewModel(record: AnalysisRecord): ReportViewModel {
  const verdict = deriveReportVerdict(record);
  return {
    verdict,
    confidence: deriveConfidenceModel(record),
    keyMetrics: preferredMetrics(record),
    diagnosticsSummary: uniqueRows(record.report.diagnostics_summary, 8),
    methodology: uniqueRows(record.report.methodology_assumptions, 8),
    limitations: uniqueRows(record.report.limitations, 8),
    recommendations: uniqueRows(record.report.recommendations, 8),
    deploymentGuidance: deriveDeploymentGuidance(record, verdict),
    charts: deriveCuratedCharts(record),
  };
}
