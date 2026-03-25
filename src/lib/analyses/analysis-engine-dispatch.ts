import { getBenchmarkLibraryHealth } from "@/lib/benchmarks/benchmark-library";
import { buildBenchmarkEnginePayload, type EngineBenchmarkConfig } from "@/lib/benchmarks/benchmark-engine-contract";
import type { AnalysisEntity } from "@/lib/server/analysis/models";
import type { ParsedArtifact, UploadEligibilitySummary } from "@/lib/server/ingestion";

export type AnalysisEngineDispatchPayload = {
  requested_diagnostics: UploadEligibilitySummary["diagnostics_available"];
  benchmark: EngineBenchmarkConfig;
};

export async function buildAnalysisEngineDispatchPayload(input: {
  analysis: AnalysisEntity;
  parsedArtifact: ParsedArtifact;
  eligibility: UploadEligibilitySummary;
}): Promise<{ config: AnalysisEngineDispatchPayload; warnings: string[] }> {
  const warnings: string[] = [];
  const defaultBenchmarkPayload = buildBenchmarkEnginePayload(input.analysis);

  if (!defaultBenchmarkPayload.enabled) {
    return {
      config: {
        requested_diagnostics: input.eligibility.diagnostics_available,
        benchmark: defaultBenchmarkPayload,
      },
      warnings,
    };
  }

  const health = await getBenchmarkLibraryHealth();
  if (health.status === "unhealthy") {
    warnings.push("benchmark_library_unhealthy_benchmark_disabled");
    return {
      config: {
        requested_diagnostics: input.eligibility.diagnostics_available,
        benchmark: {
          enabled: false,
          mode: "none",
        },
      },
      warnings,
    };
  }

  return {
    config: {
      requested_diagnostics: input.eligibility.diagnostics_available,
      benchmark: defaultBenchmarkPayload,
    },
    warnings,
  };
}
