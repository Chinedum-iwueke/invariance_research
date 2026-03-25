import { getBenchmarkLibraryRoot } from "@/lib/benchmarks/benchmark-library";
import type { AnalysisEntity } from "@/lib/server/analysis/models";

export type EngineBenchmarkConfig =
  | {
      enabled: false;
      mode: "none";
    }
  | {
      enabled: true;
      mode: "auto" | "manual";
      id: "BTC" | "SPY" | "XAUUSD" | "DXY";
      source: "platform_managed";
      library_root: string;
      library_revision: string | null;
      frequency: "1d";
      alignment_policy: "window_intersection";
      comparison_frequency: "1d";
      normalization_basis: "100_at_first_common_timestamp";
    };

export function buildBenchmarkEnginePayload(analysis: AnalysisEntity): EngineBenchmarkConfig {
  if (!analysis.benchmark?.enabled || !analysis.benchmark.resolved_id || !analysis.benchmark.source || !analysis.benchmark.frequency) {
    return {
      enabled: false,
      mode: "none",
    };
  }

  return {
    enabled: true,
    mode: analysis.benchmark.mode === "none" ? "auto" : analysis.benchmark.mode,
    id: analysis.benchmark.resolved_id,
    source: analysis.benchmark.source,
    library_root: getBenchmarkLibraryRoot(),
    library_revision: analysis.benchmark.library_revision,
    frequency: analysis.benchmark.frequency,
    alignment_policy: "window_intersection",
    comparison_frequency: "1d",
    normalization_basis: "100_at_first_common_timestamp",
  };
}
