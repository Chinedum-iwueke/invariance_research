import type { AnalysisRecord } from "@/lib/contracts";

function unique(items: Array<string | undefined>, limit = 8): string[] {
  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const value = item?.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(value);
    if (deduped.length >= limit) break;
  }
  return deduped;
}

export function buildTruthContext(record: AnalysisRecord, diagnostic: "overview" | "distribution" | "monte_carlo" | "ruin" | "report" | "regimes" | "stability") {
  const benchmark = record.engine_payload.diagnostics.overview?.benchmark_comparison;
  const benchmarkReason = typeof benchmark?.reason === "string" ? benchmark.reason : undefined;
  const benchmarkEnabled = benchmarkReason !== "benchmark_disabled" && benchmarkReason !== "benchmark_not_configured" && benchmarkReason !== "invalid_benchmark_config";
  const hasBenchmark = benchmarkReason === "available" || benchmarkReason === undefined;
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
  ]);

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
    !hasExecution && (diagnostic === "report" || diagnostic === "ruin")
      ? "Execution-friction stress interpretation is limited because execution diagnostics were not fully available."
      : undefined,
  ]);

  const recommendations = unique([
    ...("recommendations" in source && Array.isArray(source.recommendations) ? source.recommendations : []),
    ...(diagnostic === "report" ? record.report.recommendations : []),
    !hasBenchmark ? "Upload benchmark-compatible data or configure a benchmark explicitly before relying on relative-performance claims." : undefined,
    !hasRegimes ? "Add OHLCV/regime context to unlock conditional deployment analysis by market state." : undefined,
    !hasStability ? "Upload parameter sweep metadata to validate robustness across parameter neighborhoods." : undefined,
  ]);

  return { assumptions, limitations, recommendations };
}
