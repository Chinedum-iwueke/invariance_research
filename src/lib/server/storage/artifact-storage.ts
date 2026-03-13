import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const STORAGE_DIR = join(process.cwd(), ".tmp", "uploads");
mkdirSync(STORAGE_DIR, { recursive: true });

export function saveUploadedArtifact(fileName: string, bytes: Uint8Array): { storage_key: string; path: string } {
  const storageKey = `${randomUUID()}-${fileName}`;
  const path = join(STORAGE_DIR, storageKey);
  writeFileSync(path, Buffer.from(bytes));
  return { storage_key: storageKey, path };
}

export function getArtifactReference(storageKey: string): string {
  return join(STORAGE_DIR, storageKey);
}

export function readArtifact(storageKey: string): Uint8Array {
  const content = readFileSync(getArtifactReference(storageKey));
  return new Uint8Array(content);
}

export function deleteArtifact(storageKey: string): void {
  unlinkSync(getArtifactReference(storageKey));
}
