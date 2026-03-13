import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

export type BundleFileEntry = {
  path: string;
  text: string;
};

export function hasZipMagicHeader(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

export function indexBundleEntries(entries: BundleFileEntry[]): Record<string, BundleFileEntry> {
  return entries.reduce<Record<string, BundleFileEntry>>((acc, entry) => {
    acc[entry.path] = entry;
    return acc;
  }, {});
}

export function extractZipEntries(zipBytes: Uint8Array): BundleFileEntry[] {
  const tempDir = mkdtempSync(join(tmpdir(), "invariance-zip-"));
  const zipPath = join(tempDir, "artifact.zip");

  try {
    writeFileSync(zipPath, Buffer.from(zipBytes));
    const listing = execFileSync("unzip", ["-Z1", zipPath], { encoding: "utf-8" });
    const filePaths = listing.split(/\r?\n/).filter(Boolean).filter((filePath) => !filePath.endsWith("/"));

    return filePaths.map((filePath) => ({
      path: filePath,
      text: execFileSync("unzip", ["-p", zipPath, filePath], { encoding: "utf-8" }),
    }));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
