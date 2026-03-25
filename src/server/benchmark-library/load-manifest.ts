import { readFile } from "node:fs/promises";
import { parseBenchmarkManifestYaml, BenchmarkManifestError } from "@/lib/benchmarks/benchmark-manifest";
import type { BenchmarkManifest } from "@/lib/benchmarks/benchmark-types";
import { getBenchmarkManifestPath } from "@/server/benchmark-library/paths";

export async function loadBenchmarkManifest(): Promise<BenchmarkManifest> {
  const manifestPath = getBenchmarkManifestPath();
  let yaml: string;

  try {
    yaml = await readFile(manifestPath, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new BenchmarkManifestError(`Failed to read benchmark manifest at '${manifestPath}'.`, [message]);
  }

  try {
    return parseBenchmarkManifestYaml(yaml);
  } catch (error) {
    if (error instanceof BenchmarkManifestError) {
      throw new BenchmarkManifestError(`Invalid benchmark manifest at '${manifestPath}'.`, error.details);
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new BenchmarkManifestError(`Unable to parse benchmark manifest at '${manifestPath}'.`, [message]);
  }
}
