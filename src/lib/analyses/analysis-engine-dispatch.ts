import fs from "node:fs";
import { buildBenchmarkEnginePayload, type EngineBenchmarkConfig } from "@/lib/benchmarks/benchmark-engine-contract";
import type { AnalysisEntity } from "@/lib/server/analysis/models";
import type { ParsedArtifact, UploadEligibilitySummary } from "@/lib/server/ingestion";
import { getBenchmarkLibraryRoot } from "@/server/benchmark-library/paths";
import { materializeBenchmarkDataset } from "@/server/benchmark-library/materialize";

export type AnalysisEngineDispatchPayload = {
  requested_diagnostics: UploadEligibilitySummary["diagnostics_available"];
  benchmark: EngineBenchmarkConfig;
  account_size?: number;
  risk_per_trade_pct?: number;
  prop_evaluation_rules?: Record<string, unknown>;
  declared_claims?: ParsedArtifact["declared_claims"];
};

async function materializeSelectedBenchmark(benchmark: Extract<EngineBenchmarkConfig, { enabled: true }>): Promise<{ exists: boolean; libraryRoot?: string }> {
  try {
    const datasetPath = await materializeBenchmarkDataset(benchmark.id);
    return {
      exists: fs.existsSync(datasetPath),
      libraryRoot: getBenchmarkLibraryRoot(),
    };
  } catch {
    return { exists: false };
  }
}

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
        account_size: input.analysis.runtime_config?.account_size,
        risk_per_trade_pct: input.analysis.runtime_config?.risk_per_trade_pct,
        prop_evaluation_rules: input.analysis.runtime_config?.prop_evaluation_rules,
        declared_claims: input.analysis.runtime_config?.declared_claims,
      },
      warnings,
    };
  }

  const materializedBenchmark = await materializeSelectedBenchmark(defaultBenchmarkPayload);
  if (!materializedBenchmark.exists) {
    warnings.push("selected_benchmark_dataset_missing_benchmark_disabled");
    return {
      config: {
        requested_diagnostics: input.eligibility.diagnostics_available,
        benchmark: {
          enabled: false,
          mode: "none",
        },
        account_size: input.analysis.runtime_config?.account_size,
        risk_per_trade_pct: input.analysis.runtime_config?.risk_per_trade_pct,
        prop_evaluation_rules: input.analysis.runtime_config?.prop_evaluation_rules,
        declared_claims: input.analysis.runtime_config?.declared_claims,
      },
      warnings,
    };
  }

  return {
    config: {
      requested_diagnostics: input.eligibility.diagnostics_available,
      benchmark: {
        ...defaultBenchmarkPayload,
        library_root: materializedBenchmark.libraryRoot ?? defaultBenchmarkPayload.library_root,
      },
      account_size: input.analysis.runtime_config?.account_size,
      risk_per_trade_pct: input.analysis.runtime_config?.risk_per_trade_pct,
      prop_evaluation_rules: input.analysis.runtime_config?.prop_evaluation_rules,
      declared_claims: input.analysis.runtime_config?.declared_claims,
    },
    warnings,
  };
}
