import { readFile } from "node:fs/promises";
import { logger } from "@/lib/server/ops/logger";
import { getObjectStorage } from "@/lib/server/storage/object-storage";
import { getBenchmarkManifestPath } from "@/server/benchmark-library/paths";

export type BenchmarkProviderName = "local" | "object_storage";

export interface BenchmarkManifestProvider {
  readonly name: BenchmarkProviderName;
  loadManifestYaml(): Promise<{ yaml: string; source: string }>;
}

export function getBenchmarkProviderName(): BenchmarkProviderName {
  const provider = process.env.BENCHMARK_PROVIDER?.trim() || "local";
  if (provider !== "local" && provider !== "object_storage") {
    throw new Error(`Unsupported BENCHMARK_PROVIDER "${provider}". Expected local or object_storage.`);
  }
  return provider;
}

export function getBenchmarkManifestObjectKey() {
  return process.env.BENCHMARK_MANIFEST_OBJECT_KEY?.trim() || "benchmarks/manifest.v1.yaml";
}

export function getBenchmarkManifestCacheTtlMs() {
  const parsed = Number(process.env.BENCHMARK_MANIFEST_CACHE_TTL_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 300_000;
}

const localManifestProvider: BenchmarkManifestProvider = {
  name: "local",
  async loadManifestYaml() {
    const manifestPath = getBenchmarkManifestPath();
    if (process.env.NODE_ENV === "production") {
      logger.warn("benchmark.local_provider.production_warning", { manifest_path: manifestPath });
    }
    return { yaml: await readFile(manifestPath, "utf8"), source: manifestPath };
  },
};

const objectStorageManifestProvider: BenchmarkManifestProvider = {
  name: "object_storage",
  async loadManifestYaml() {
    const objectKey = getBenchmarkManifestObjectKey();
    const bytes = await getObjectStorage().getObject(objectKey);
    return { yaml: Buffer.from(bytes).toString("utf8"), source: objectKey };
  },
};

export function getBenchmarkManifestProvider(): BenchmarkManifestProvider {
  return getBenchmarkProviderName() === "object_storage" ? objectStorageManifestProvider : localManifestProvider;
}
