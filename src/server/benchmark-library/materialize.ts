import fs from "node:fs/promises";
import path from "node:path";
import { getObjectStorage } from "@/lib/server/storage/object-storage";
import { loadBenchmarkManifest } from "@/server/benchmark-library/load-manifest";
import { getBenchmarkProviderName } from "@/server/benchmark-library/manifest-provider";
import { getBenchmarkDatasetPath } from "@/server/benchmark-library/paths";
import type { BenchmarkId } from "@/lib/benchmarks/benchmark-ids";

function benchmarkObjectKey(relativeFilePath: string) {
  const prefix = process.env.BENCHMARK_OBJECT_PREFIX?.trim() || "benchmarks";
  return `${prefix.replace(/\/$/, "")}/${relativeFilePath.replace(/^\//, "")}`;
}

async function exists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function materializeBenchmarkDataset(benchmarkId: BenchmarkId): Promise<string> {
  const manifest = await loadBenchmarkManifest();
  const entry = manifest.benchmarks[benchmarkId];
  const localPath = getBenchmarkDatasetPath(entry.file);
  if (await exists(localPath)) return localPath;

  if (getBenchmarkProviderName() !== "object_storage") return localPath;

  const bytes = await getObjectStorage().getObject(benchmarkObjectKey(entry.file));
  await fs.mkdir(path.dirname(localPath), { recursive: true });
  await fs.writeFile(localPath, Buffer.from(bytes));
  return localPath;
}
