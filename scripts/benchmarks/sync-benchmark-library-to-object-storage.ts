import fs from "node:fs/promises";
import path from "node:path";
import { getObjectStorage } from "../../src/lib/server/storage/object-storage";
import { getBenchmarkLibraryRoot } from "../../src/server/benchmark-library/paths";

const BENCHMARK_FILES = [
  "manifest.v1.yaml",
  "BTC/daily.parquet",
  "SPY/daily.parquet",
  "DXY/daily.parquet",
  "XAUUSD/daily.parquet",
] as const;

function contentType(filePath: string) {
  if (filePath.endsWith(".yaml") || filePath.endsWith(".yml")) return "application/yaml";
  if (filePath.endsWith(".parquet")) return "application/vnd.apache.parquet";
  return "application/octet-stream";
}

async function main() {
  const root = getBenchmarkLibraryRoot();
  const storage = getObjectStorage();
  const uploaded: Array<{ file: string; storage_key: string; size: number }> = [];

  for (const relativePath of BENCHMARK_FILES) {
    const absolutePath = path.join(root, relativePath);
    const bytes = new Uint8Array(await fs.readFile(absolutePath));
    const stored = await storage.putObject({
      bucket: "analysis-artifacts",
      file_name: relativePath,
      content_type: contentType(relativePath),
      bytes,
      storage_key: `benchmarks/${relativePath}`,
    });
    uploaded.push({ file: relativePath, storage_key: stored.storage_key, size: stored.size_bytes });
  }

  console.log(JSON.stringify({ ok: true, root, uploaded }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
