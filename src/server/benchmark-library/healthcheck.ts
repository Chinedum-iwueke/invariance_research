import { BENCHMARK_IDS } from "@/lib/benchmarks/benchmark-ids";
import { validateBenchmarkDataset } from "@/lib/benchmarks/benchmark-validation";
import type { BenchmarkId } from "@/lib/benchmarks/benchmark-ids";
import type { BenchmarkLibraryHealthResult, BenchmarkValidationResult } from "@/lib/benchmarks/benchmark-types";
import { BenchmarkManifestError } from "@/lib/benchmarks/benchmark-manifest";
import { loadBenchmarkManifest } from "@/server/benchmark-library/load-manifest";
import { getBenchmarkDatasetPath, getBenchmarkManifestPath } from "@/server/benchmark-library/paths";

export async function getBenchmarkLibraryHealth(): Promise<BenchmarkLibraryHealthResult> {
  const manifestPath = getBenchmarkManifestPath();

  try {
    const manifest = await loadBenchmarkManifest();
    const benchmarkResults = {} as Record<BenchmarkId, BenchmarkValidationResult>;

    for (const benchmarkId of BENCHMARK_IDS) {
      const entry = manifest.benchmarks[benchmarkId];
      const datasetPath = getBenchmarkDatasetPath(entry.file);
      benchmarkResults[benchmarkId] = await validateBenchmarkDataset({ benchmarkId, datasetPath });
    }

    const hasFailures = Object.values(benchmarkResults).some((result) => !result.isValid);

    return {
      status: hasFailures ? "degraded" : "healthy",
      revision: manifest.revision,
      manifestPath,
      benchmarkEntryCount: Object.keys(manifest.benchmarks).length,
      benchmarkIds: [...BENCHMARK_IDS],
      benchmarkResults,
      errors: hasFailures ? ["One or more benchmark datasets failed validation."] : [],
    };
  } catch (error) {
    const details: string[] = [];
    if (error instanceof BenchmarkManifestError) {
      details.push(error.message, ...error.details);
    } else if (error instanceof Error) {
      details.push(error.message);
    } else {
      details.push(String(error));
    }

    const benchmarkResults = {} as Record<BenchmarkId, BenchmarkValidationResult>;
    for (const benchmarkId of BENCHMARK_IDS) {
      benchmarkResults[benchmarkId] = {
        benchmarkId,
        datasetPath: "",
        isValid: false,
        coverage: { startTs: null, endTs: null, rowCount: null },
        issues: [{ code: "invalid_manifest_entry", message: "Validation skipped because manifest could not be loaded." }],
      };
    }

    return {
      status: "unhealthy",
      revision: null,
      manifestPath,
      benchmarkEntryCount: 0,
      benchmarkIds: [...BENCHMARK_IDS],
      benchmarkResults,
      errors: details,
    };
  }
}
