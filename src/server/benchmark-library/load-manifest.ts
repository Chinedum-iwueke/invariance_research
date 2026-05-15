import { parseBenchmarkManifestYaml, BenchmarkManifestError } from "@/lib/benchmarks/benchmark-manifest";
import type { BenchmarkManifest } from "@/lib/benchmarks/benchmark-types";
import { getBenchmarkManifestCacheTtlMs, getBenchmarkManifestProvider } from "@/server/benchmark-library/manifest-provider";

let cachedManifest: { manifest: BenchmarkManifest; source: string; loadedAt: number; expiresAt: number; provider: string } | undefined;

export function getBenchmarkManifestCacheStatus() {
  const now = Date.now();
  return {
    provider: cachedManifest?.provider ?? getBenchmarkManifestProvider().name,
    source: cachedManifest?.source,
    cached: Boolean(cachedManifest && cachedManifest.expiresAt > now),
    loaded_at: cachedManifest ? new Date(cachedManifest.loadedAt).toISOString() : undefined,
    expires_at: cachedManifest ? new Date(cachedManifest.expiresAt).toISOString() : undefined,
    ttl_ms: getBenchmarkManifestCacheTtlMs(),
  };
}

export function clearBenchmarkManifestCacheForTests() {
  cachedManifest = undefined;
}

export async function loadBenchmarkManifest(): Promise<BenchmarkManifest> {
  const now = Date.now();
  if (cachedManifest && cachedManifest.expiresAt > now) {
    return cachedManifest.manifest;
  }

  const provider = getBenchmarkManifestProvider();
  let loaded: { yaml: string; source: string };
  try {
    loaded = await provider.loadManifestYaml();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new BenchmarkManifestError(`Failed to read benchmark manifest from '${provider.name}'.`, [message]);
  }

  try {
    const manifest = parseBenchmarkManifestYaml(loaded.yaml);
    cachedManifest = {
      manifest,
      source: loaded.source,
      loadedAt: now,
      expiresAt: now + getBenchmarkManifestCacheTtlMs(),
      provider: provider.name,
    };
    return manifest;
  } catch (error) {
    if (error instanceof BenchmarkManifestError) {
      throw new BenchmarkManifestError(`Invalid benchmark manifest from '${loaded.source}'.`, error.details);
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new BenchmarkManifestError(`Unable to parse benchmark manifest from '${loaded.source}'.`, [message]);
  }
}
