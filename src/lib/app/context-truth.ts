import type { AnalysisRecord } from "@/lib/contracts";
import type { AnalysisBenchmarkConfig } from "@/lib/analyses/analysis-types";

function normalizeItem(item: unknown): string | undefined {
  if (typeof item === "string") {
    const value = item.trim();
    return value.length > 0 ? value : undefined;
  }
  if (!item || typeof item !== "object") return undefined;
  const record = item as Record<string, unknown>;
  for (const key of ["message", "text", "value", "label", "title"]) {
    if (typeof record[key] === "string" && record[key].trim().length > 0) {
      return record[key].trim();
    }
  }
  return undefined;
}

function unique(items: unknown[], limit = 8): string[] {
  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const value = normalizeItem(item);
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(value);
    if (deduped.length >= limit) break;
  }
  return deduped;
}

function isInternalAssumption(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "engine=bt"
    || normalized === "seam=run_analysis_from_parsed_artifact"
    || normalized.startsWith("engine=")
    || normalized.startsWith("seam=");
}

function isAuditLevelMissingRecommendation(value: string): boolean {
  return /ohlcv|regime context|regime labels|parameter sweep|parameter metadata|parameter stability/i.test(value);
}

function isBenchmarkMissingRecommendation(value: string): boolean {
  return /benchmark-compatible|configure a benchmark|benchmark config|benchmark context/i.test(value);
}

function pageSpecificRecommendations(diagnostic: string, items: unknown[]): string[] {
  const normalized = unique(items, 12);
  const filtered = normalized.filter((item) => {
    if (diagnostic !== "report" && isAuditLevelMissingRecommendation(item)) return false;
    if (diagnostic === "distribution" && /monte carlo|ruin|capital buffer|deployment/i.test(item)) return false;
    if (diagnostic === "monte_carlo" && /trade distribution|win\/loss|duration|skew|parameter/i.test(item)) return false;
    if (diagnostic === "overview" && normalized.length > 3 && isAuditLevelMissingRecommendation(item)) return false;
    return true;
  });
  return filtered.slice(0, diagnostic === "overview" ? 4 : 6);
}

export function buildTruthContext(
  record: AnalysisRecord,
  diagnostic: "overview" | "distribution" | "monte_carlo" | "execution" | "ruin" | "prop_evaluation_readiness" | "report" | "regimes" | "stability",
  options?: { benchmark?: AnalysisBenchmarkConfig },
) {
  const benchmark = record.engine_payload.diagnostics.overview?.benchmark_comparison;
  const benchmarkReason = typeof benchmark?.reason === "string" ? benchmark.reason : undefined;
  const benchmarkMetadata = benchmark?.metadata && typeof benchmark.metadata === "object"
    ? (benchmark.metadata as Record<string, unknown>)
    : undefined;
  const benchmarkSummary = benchmark?.summary_metrics && typeof benchmark.summary_metrics === "object"
    ? (benchmark.summary_metrics as Record<string, unknown>)
    : undefined;
  const benchmarkWasSelected = typeof benchmarkSummary?.benchmark_selected === "string"
    || typeof benchmarkMetadata?.benchmark_id === "string";
  const benchmarkWasConfigured = Boolean(options?.benchmark?.enabled || benchmarkWasSelected);
  const benchmarkEnabled = benchmarkReason !== "benchmark_disabled" && benchmarkReason !== "benchmark_not_configured" && benchmarkReason !== "invalid_benchmark_config";
  const hasBenchmark = benchmark?.status === "available" || benchmarkReason === "available";
  const hasRegimes = record.diagnostic_statuses.regimes.status === "available";
  const hasStability = record.diagnostic_statuses.stability.status === "available";
  const hasExecution = record.diagnostic_statuses.execution.status === "available";

  const source = diagnostic === "report"
    ? record.report
    : record.diagnostics[diagnostic];

  const assumptions = unique([
    ...("assumptions" in source && Array.isArray(source.assumptions) ? source.assumptions : []),
    ...(diagnostic === "report" ? [] : record.report.methodology_assumptions),
    !benchmarkEnabled ? "Benchmark comparison was explicitly disabled for this run configuration." : undefined,
  ]).filter((item) => !isInternalAssumption(item));

  const limitations = unique([
    ...("limitations" in source && Array.isArray(source.limitations) ? source.limitations : []),
    ...(diagnostic === "report" ? record.report.limitations : []),
    !hasBenchmark ? "Benchmark-relative attribution is unavailable because benchmark overlap/configuration was not valid for this run." : undefined,
    !hasRegimes && (diagnostic === "report" || diagnostic === "overview" || diagnostic === "distribution")
      ? "Regime decomposition is unavailable for this artifact/run context."
      : undefined,
    !hasStability && (diagnostic === "report" || diagnostic === "overview")
      ? "Parameter stability diagnostics are unavailable for this artifact/run context."
      : undefined,
    !hasExecution && (diagnostic === "report" || diagnostic === "ruin" || diagnostic === "prop_evaluation_readiness")
      ? "Execution-friction stress interpretation is limited because execution diagnostics were not fully available."
      : undefined,
  ]);

  const recommendations = pageSpecificRecommendations(diagnostic, [
    ...("recommendations" in source && Array.isArray(source.recommendations) ? source.recommendations : []),
    ...(diagnostic === "report" ? record.report.recommendations : []),
    !hasBenchmark && !benchmarkWasConfigured
      ? "Upload benchmark-compatible data or configure a benchmark explicitly before relying on relative-performance claims."
      : !hasBenchmark && benchmarkReason === "no_benchmark_overlap"
        ? "Benchmark was selected, but overlap with strategy timestamps was insufficient for reliable relative-performance claims."
        : !hasBenchmark
          ? "Benchmark context is configured but currently unavailable; resolve benchmark data/alignment issues before relying on relative-performance claims."
          : undefined,
    diagnostic === "report" && !hasRegimes ? "Audit-level diagnostic gap: add OHLCV or explicit regime labels to unlock conditional deployment analysis by market state." : undefined,
    diagnostic === "report" && !hasStability ? "Audit-level diagnostic gap: upload parameter sweep metadata to validate robustness across parameter neighborhoods." : undefined,
  ]).filter((item) => !((hasBenchmark || benchmarkWasConfigured) && isBenchmarkMissingRecommendation(item)));

  return { assumptions, limitations, recommendations };
}
