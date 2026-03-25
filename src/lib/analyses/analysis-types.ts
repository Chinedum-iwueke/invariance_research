import type { BenchmarkId } from "@/lib/benchmarks/benchmark-ids";
import type { BenchmarkResolutionReason, BenchmarkSelectionMode } from "@/lib/benchmarks/benchmark-types";

export type AnalysisBenchmarkSelectionInput = {
  mode: BenchmarkSelectionMode;
  requested_id: BenchmarkId | null;
};

export type AnalysisBenchmarkConfig = {
  mode: BenchmarkSelectionMode;
  requested_id: BenchmarkId | null;
  resolved_id: BenchmarkId | null;
  resolution_reason: BenchmarkResolutionReason;
  source: "platform_managed" | null;
  frequency: "1d" | null;
  library_revision: string | null;
  enabled: boolean;
};
