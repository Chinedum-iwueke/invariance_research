import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { BenchmarkId } from "@/lib/benchmarks/benchmark-ids";

const DEFAULT_LIBRARY_ROOT_CWD = path.join(process.cwd(), "platform_data", "benchmarks");
const DEFAULT_LIBRARY_ROOT_HOME = path.join(os.homedir(), "platform_data", "benchmarks");
const MANIFEST_FILE_NAME = "manifest.v1.yaml";

export function getBenchmarkLibraryRoot(): string {
  const configured = process.env.INVARIANCE_BENCHMARK_LIBRARY_ROOT?.trim();
  if (configured) return configured;

  if (fs.existsSync(DEFAULT_LIBRARY_ROOT_CWD)) return DEFAULT_LIBRARY_ROOT_CWD;
  if (fs.existsSync(DEFAULT_LIBRARY_ROOT_HOME)) return DEFAULT_LIBRARY_ROOT_HOME;

  return DEFAULT_LIBRARY_ROOT_CWD;
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
