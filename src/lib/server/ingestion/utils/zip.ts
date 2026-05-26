import JSZip from "jszip";

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

export async function extractZipEntries(zipBytes: Uint8Array): Promise<BundleFileEntry[]> {
  const zip = await JSZip.loadAsync(Buffer.from(zipBytes));
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);

  return Promise.all(
    entries.map(async (entry) => ({
      path: entry.name,
      text: await entry.async("text"),
    })),
  );
}
