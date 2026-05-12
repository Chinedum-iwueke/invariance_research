import type { AnalysisBenchmarkConfig } from "@/lib/analyses/analysis-types";
import type { AnalysisRecord, LlmDiagnosticInsights } from "@/lib/contracts";
import { llmDiagnosticInsightsSchema } from "@/lib/contracts/analysis.schema";
import { OllamaClient } from "@/lib/server/llm/ollama-client";
import { buildInsightPrompt } from "@/lib/server/llm/insight-prompts";
import {
  ollamaStructuredInsightJsonSchema,
  structuredInsightResponseSchema,
  type StructuredInsightResponse,
} from "@/lib/server/llm/insight-schemas";

export type InsightPage = keyof LlmDiagnosticInsights["recommendations_by_page"];

export interface DiagnosticInsightContext {
  analysis_id: string;
  strategy_name: string;
  asset_or_symbols: string;
  trade_count: number;
  win_rate?: string;
  expectancy?: string;
  sharpe?: string;
  max_drawdown?: string;
  fee_drag?: string;
  benchmark_comparison?: string;
  execution_diagnostics: string[];
  distribution_metrics: string[];
  monte_carlo?: {
    p50_drawdown?: string;
    p95_drawdown?: string;
    worst_drawdown?: string;
  };
  probability_of_ruin?: string;
  longest_losing_streak?: string;
  benchmark?: {
    present: boolean;
    configured: boolean;
    label?: string;
    status?: string;
  };
  artifact_richness?: string;
  benchmark_availability: string;
  available_diagnostics: string[];
  missing_diagnostics: string[];
  known_limitations: string[];
  deterministic_warnings: string[];
  deterministic_limitations: string[];
  deterministic_recommendations: Record<InsightPage, string[]>;
}

export interface LlmInsightGenerationResult {
  insights?: LlmDiagnosticInsights;
  status: NonNullable<AnalysisRecord["llm_insights_status"]>;
  model?: string;
  generated_at?: string;
  error?: string;
  duration_ms?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  timeout_reason?: string;
}

const PAGES: InsightPage[] = ["overview", "distribution", "monte_carlo", "execution", "ruin", "report"];

function metricValue(record: AnalysisRecord, labels: RegExp[]): string | undefined {
  const pools = [
    record.diagnostics.overview.metrics,
    record.diagnostics.distribution.metrics,
    record.diagnostics.monte_carlo.metrics,
    record.diagnostics.execution.metrics,
    record.diagnostics.ruin.metrics,
  ];
  for (const metrics of pools) {
    const match = metrics.find((metric) => labels.some((label) => label.test(metric.label)));
    if (match?.value && !/unavailable|n\/a|unknown/i.test(match.value)) return match.value;
  }
  return undefined;
}

function unique(items: Array<string | undefined>, limit = 8): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const item of items) {
    const trimmed = item?.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(trimmed);
    if (output.length >= limit) break;
  }
  return output;
}

function hasConfiguredBenchmark(record: AnalysisRecord, benchmark?: AnalysisBenchmarkConfig): boolean {
  const comparison = record.engine_payload.diagnostics.overview?.benchmark_comparison;
  const metadata = comparison?.metadata && typeof comparison.metadata === "object" ? comparison.metadata as Record<string, unknown> : undefined;
  const summary = comparison?.summary_metrics && typeof comparison.summary_metrics === "object" ? comparison.summary_metrics as Record<string, unknown> : undefined;
  return Boolean(
    benchmark?.enabled
    || metadata?.benchmark_id
    || summary?.benchmark_selected
    || comparison?.status === "available"
    || comparison?.reason === "available",
  );
}

export function buildDiagnosticInsightContext(record: AnalysisRecord, benchmark?: AnalysisBenchmarkConfig): DiagnosticInsightContext {
  const diagnosticEntries = Object.entries(record.diagnostic_statuses);
  const benchmarkConfigured = hasConfiguredBenchmark(record, benchmark);
  const benchmarkComparison = record.engine_payload.diagnostics.overview?.benchmark_comparison;
  const benchmarkMetadata = benchmarkComparison?.metadata && typeof benchmarkComparison.metadata === "object"
    ? benchmarkComparison.metadata as Record<string, unknown>
    : undefined;
  const benchmarkStatus = typeof benchmarkComparison?.status === "string"
    ? benchmarkComparison.status
    : typeof benchmarkComparison?.reason === "string"
      ? benchmarkComparison.reason
      : undefined;

  return {
    analysis_id: record.analysis_id,
    strategy_name: record.strategy.strategy_name,
    asset_or_symbols: record.strategy.symbols.length > 1 ? `Multi-Asset: ${record.strategy.symbols.join(", ")}` : record.strategy.symbols[0] ?? record.dataset.market ?? "N/A",
    trade_count: record.dataset.trade_count,
    win_rate: metricValue(record, [/win rate/i]),
    expectancy: metricValue(record, [/expectancy/i]),
    sharpe: metricValue(record, [/sharpe/i]),
    max_drawdown: metricValue(record, [/max drawdown/i, /worst.*drawdown/i]),
    fee_drag: metricValue(record, [/edge decay/i, /fee|cost|slippage|spread/i]),
    benchmark_comparison: metricValue(record, [/excess return|benchmark/i]),
    execution_diagnostics: record.diagnostics.execution.metrics.map((metric) => `${metric.label}: ${metric.value}`).slice(0, 8),
    distribution_metrics: record.diagnostics.distribution.metrics.map((metric) => `${metric.label}: ${metric.value}`).slice(0, 8),
    monte_carlo: {
      p50_drawdown: metricValue(record, [/median drawdown/i]),
      p95_drawdown: metricValue(record, [/95.*drawdown/i]),
      worst_drawdown: metricValue(record, [/worst.*drawdown/i]),
    },
    probability_of_ruin: metricValue(record, [/probability of ruin/i, /risk-of-ruin/i, /p\(ruin\)/i]),
    longest_losing_streak: metricValue(record, [/max consecutive losses/i, /longest losing/i]),
    benchmark: {
      present: benchmarkComparison?.status === "available" || benchmarkComparison?.reason === "available",
      configured: benchmarkConfigured,
      label: (typeof benchmarkMetadata?.benchmark_id === "string" ? benchmarkMetadata.benchmark_id : benchmark?.resolved_id ?? benchmark?.requested_id) ?? undefined,
      status: benchmarkStatus,
    },
    artifact_richness: record.strategy.description?.replace(/^Artifact classified as\s*/i, "").replace(/\.$/, ""),
    benchmark_availability: benchmarkStatus ?? (benchmarkConfigured ? "configured" : "not_configured"),
    available_diagnostics: diagnosticEntries.filter(([, status]) => status.status === "available").map(([name]) => name),
    missing_diagnostics: diagnosticEntries.filter(([, status]) => status.status !== "available").map(([name, status]) => `${name}: ${status.status}`),
    known_limitations: unique([
      ...record.report.limitations,
      ...(record.diagnostics.distribution.limitations ?? []),
      ...(record.diagnostics.monte_carlo.limitations ?? []),
      ...(record.diagnostics.execution.limitations ?? []),
      ...(record.diagnostics.regimes.limitations ?? []),
      ...(record.diagnostics.ruin.limitations ?? []),
    ], 12),
    deterministic_warnings: unique(record.summary.warnings.map((warning) => `${warning.title}: ${warning.message}`), 8),
    deterministic_limitations: unique([
      ...record.report.limitations,
      ...(record.diagnostics.distribution.limitations ?? []),
      ...(record.diagnostics.monte_carlo.limitations ?? []),
      ...(record.diagnostics.execution.limitations ?? []),
      ...(record.diagnostics.ruin.limitations ?? []),
    ], 10),
    deterministic_recommendations: {
      overview: record.diagnostics.overview.recommendations ?? [],
      distribution: record.diagnostics.distribution.recommendations ?? [],
      monte_carlo: record.diagnostics.monte_carlo.recommendations ?? [],
      execution: record.diagnostics.execution.recommendations ?? [],
      ruin: record.diagnostics.ruin.recommendations ?? [],
      report: record.report.recommendations,
    },
  };
}

function llmEnabled(): boolean {
  return process.env.LLM_INSIGHTS_ENABLED?.trim().toLowerCase() === "true";
}

function validateNoContradictions(insights: LlmDiagnosticInsights, context: DiagnosticInsightContext): string | undefined {
  const serialized = JSON.stringify(insights).toLowerCase();
  if (/guarantee|guaranteed|promise|will be profitable|profitability is assured/.test(serialized)) {
    return "unsupported_profitability_claim";
  }
  if (context.benchmark?.configured && /benchmark config|configure a benchmark|add a benchmark|provide benchmark|missing benchmark|benchmark-compatible data/.test(serialized)) {
    return "benchmark_missing_recommendation_contradicts_config";
  }
  if (context.probability_of_ruin && Number.parseFloat(context.probability_of_ruin) >= 12 && insights.deployment_readiness.status === "advisable") {
    return "advisable_status_contradicts_elevated_ruin";
  }
  return undefined;
}

export function validateLlmInsights(payload: unknown, context: DiagnosticInsightContext): LlmDiagnosticInsights | undefined {
  const parsed = llmDiagnosticInsightsSchema.safeParse(payload);
  if (!parsed.success) return undefined;
  return validateNoContradictions(parsed.data, context) ? undefined : parsed.data;
}

function parseJsonWithRepair(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first >= 0 && last > first) return JSON.parse(trimmed.slice(first, last + 1));
    throw error;
  }
}

function normalizeRecommendations(items: string[], contextItems: string[]): string[] {
  const contextSerialized = contextItems.join(" ").toLowerCase();
  return unique(items.filter((item) => {
    if (/benchmark config|configure a benchmark|benchmark-compatible/i.test(item) && /benchmark.*available|benchmark.*configured/i.test(contextSerialized)) return false;
    return true;
  }), 5);
}

function structuredToContract(structured: StructuredInsightResponse, context: DiagnosticInsightContext): LlmDiagnosticInsights {
  const recommendations = structured.recommendation_bundle;
  const nextActions = unique([
    ...structured.deployment_readiness_assessment.next_experiments,
    ...structured.deployment_readiness_assessment.blockers,
  ], 5);
  return {
    overview_interpretation: structured.validation_verdict.summary,
    distribution_interpretation: structured.distribution_interpretation_detail.summary,
    monte_carlo_interpretation: structured.monte_carlo_interpretation_detail.summary,
    execution_interpretation: structured.execution_interpretation_detail.summary,
    ruin_interpretation: structured.risk_of_ruin_interpretation.summary,
    final_verdict: structured.validation_verdict.summary,
    deployment_readiness: {
      status: structured.deployment_readiness_assessment.readiness_status,
      headline: structured.deployment_readiness_assessment.summary.slice(0, 220),
      rationale: structured.deployment_readiness_assessment.confidence_notes,
      next_actions: nextActions,
    },
    recommendations_by_page: {
      overview: normalizeRecommendations(recommendations.overview, context.deterministic_recommendations.overview),
      distribution: normalizeRecommendations(recommendations.distribution, context.deterministic_recommendations.distribution),
      monte_carlo: normalizeRecommendations(recommendations.monte_carlo, context.deterministic_recommendations.monte_carlo),
      execution: normalizeRecommendations(recommendations.execution, context.deterministic_recommendations.execution),
      ruin: normalizeRecommendations(recommendations.ruin, context.deterministic_recommendations.ruin),
      report: normalizeRecommendations(recommendations.report, context.deterministic_recommendations.report),
    },
    validation_verdict: structured.validation_verdict,
    deployment_readiness_assessment: structured.deployment_readiness_assessment,
    recommendation_bundle: structured.recommendation_bundle,
    execution_interpretation_detail: structured.execution_interpretation_detail,
    distribution_interpretation_detail: structured.distribution_interpretation_detail,
    monte_carlo_interpretation_detail: structured.monte_carlo_interpretation_detail,
    risk_of_ruin_interpretation: structured.risk_of_ruin_interpretation,
  };
}

function envConfig() {
  return {
    provider: process.env.LLM_PROVIDER?.trim().toLowerCase() || "ollama",
    model: process.env.OLLAMA_MODEL?.trim() || "llama3.1:8b",
    baseUrl: process.env.OLLAMA_BASE_URL?.trim() || "http://localhost:11434",
    timeoutMs: Number.parseInt(process.env.LLM_INSIGHTS_TIMEOUT_MS ?? "15000", 10),
  };
}

export async function generateLlmInsightsForRecord(record: AnalysisRecord, benchmark?: AnalysisBenchmarkConfig): Promise<LlmInsightGenerationResult> {
  if (!llmEnabled()) return { status: "disabled" };

  const { provider, model, baseUrl, timeoutMs } = envConfig();
  if (provider !== "ollama") return { status: "failed", error: `Unsupported LLM_PROVIDER=${provider}` };

  const context = buildDiagnosticInsightContext(record, benchmark);
  const client = new OllamaClient({ baseUrl, model, timeoutMs, retries: 1 });
  try {
    const ollamaResult = await client.structuredChat(buildInsightPrompt(context), ollamaStructuredInsightJsonSchema);
    const json = parseJsonWithRepair(ollamaResult.content);
    const structured = structuredInsightResponseSchema.parse(json);
    const contract = structuredToContract(structured, context);
    const insights = validateLlmInsights(contract, context);
    if (!insights) return { status: "invalid", model, duration_ms: ollamaResult.duration_ms, error: "llm_schema_or_fact_validation_failed" };
    return {
      status: "generated",
      model: ollamaResult.model,
      generated_at: new Date().toISOString(),
      insights,
      duration_ms: ollamaResult.duration_ms,
      prompt_tokens: ollamaResult.prompt_tokens,
      completion_tokens: ollamaResult.completion_tokens,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "ollama_unavailable";
    return {
      status: "fallback",
      model,
      error: message,
      timeout_reason: /timeout|abort/i.test(message) ? message : undefined,
    };
  }
}

export function mergeLlmInsightResult(record: AnalysisRecord, result: LlmInsightGenerationResult): AnalysisRecord {
  const deploymentGuidance = result.insights
    ? unique([
        ...record.report.deployment_guidance,
        `AI-assisted synthesis: ${result.insights.deployment_readiness.headline}`,
        ...result.insights.deployment_readiness.next_actions,
      ], 8)
    : record.report.deployment_guidance;

  return {
    ...record,
    report: {
      ...record.report,
      deployment_guidance: deploymentGuidance,
    },
    engine_payload: {
      ...record.engine_payload,
      report_sections: {
        ...record.engine_payload.report_sections,
        recommendations: unique([
          ...record.engine_payload.report_sections.recommendations,
          ...(result.insights?.recommendations_by_page.report ?? []),
        ], 8),
      },
    },
    llm_insights: result.insights,
    llm_insights_model: result.model,
    llm_insights_generated_at: result.generated_at,
    llm_insights_status: result.status,
    llm_insights_error: result.error,
  };
}

export function pageInsightRecommendations(record: AnalysisRecord, page: InsightPage, fallback: string[]): string[] {
  return unique([...(record.llm_insights?.recommendations_by_page[page] ?? []), ...fallback], 5);
}

export function llmInsightStatusLabel(record: AnalysisRecord): string | undefined {
  if (record.llm_insights_status !== "generated") return undefined;
  return `AI-assisted synthesis${record.llm_insights_model ? ` · ${record.llm_insights_model}` : ""}`;
}

export { PAGES };
