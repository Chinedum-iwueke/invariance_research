import type { BenchmarkId } from "@/lib/benchmarks/benchmark-ids";
import { loadBenchmarkManifest } from "@/server/benchmark-library/load-manifest";
import { getBenchmarkLibraryHealth } from "@/server/benchmark-library/healthcheck";
import { getBenchmarkDatasetPath as resolveBenchmarkDatasetPath, getBenchmarkLibraryRoot, getBenchmarkManifestPath } from "@/server/benchmark-library/paths";

export { getBenchmarkLibraryRoot, getBenchmarkManifestPath };

export async function getBenchmarkManifest() {
  return loadBenchmarkManifest();
}

export async function getBenchmarkMetadata(benchmarkId: BenchmarkId) {
  const manifest = await loadBenchmarkManifest();
  return manifest.benchmarks[benchmarkId];
}

export async function getBenchmarkDatasetPath(benchmarkId: BenchmarkId): Promise<string> {
  const metadata = await getBenchmarkMetadata(benchmarkId);
  return resolveBenchmarkDatasetPath(benchmarkId, metadata.file);
}

export async function getBenchmarkCoverage(benchmarkId: BenchmarkId) {
  const health = await getBenchmarkLibraryHealth();
  return health.benchmarkResults[benchmarkId].coverage;
}

export { getBenchmarkLibraryHealth };
