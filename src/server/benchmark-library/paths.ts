import path from "node:path";
import type { BenchmarkId } from "@/lib/benchmarks/benchmark-ids";

const DEFAULT_LIBRARY_ROOT = path.join(process.cwd(), "platform_data", "benchmarks");
const MANIFEST_FILE_NAME = "manifest.v1.yaml";

export function getBenchmarkLibraryRoot(): string {
  return process.env.INVARIANCE_BENCHMARK_LIBRARY_ROOT ?? DEFAULT_LIBRARY_ROOT;
}

export function getBenchmarkManifestPath(): string {
  return path.join(getBenchmarkLibraryRoot(), MANIFEST_FILE_NAME);
}

export function getBenchmarkDatasetPath(relativeFilePath: string): string;
export function getBenchmarkDatasetPath(benchmarkId: BenchmarkId, relativeFilePath: string): string;
export function getBenchmarkDatasetPath(arg1: string, arg2?: string): string {
  const relativeFilePath = arg2 ?? arg1;
  return path.resolve(getBenchmarkLibraryRoot(), relativeFilePath);
}
