import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";

export type StoredObject = {
  storage_key: string;
  content_type: string;
  size_bytes: number;
  checksum_sha256: string;
};

export interface ObjectStorage {
  putObject(input: { bucket: "uploads" | "exports"; file_name: string; content_type: string; bytes: Uint8Array }): StoredObject;
  getObject(storageKey: string): Uint8Array;
  deleteObject(storageKey: string): void;
  objectExists(storageKey: string): boolean;
}

const ROOT = process.env.INVARIANCE_STORAGE_ROOT ?? path.join(process.cwd(), ".data", "storage");

function resolvePath(storageKey: string) {
  return path.join(ROOT, storageKey);
}

function checksum(bytes: Uint8Array) {
  return createHash("sha256").update(Buffer.from(bytes)).digest("hex");
}

export const localObjectStorage: ObjectStorage = {
  putObject(input) {
    const safeName = input.file_name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storageKey = `${input.bucket}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${safeName}`;
    const targetPath = resolvePath(storageKey);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, Buffer.from(input.bytes));
    return {
      storage_key: storageKey,
      content_type: input.content_type,
      size_bytes: input.bytes.byteLength,
      checksum_sha256: checksum(input.bytes),
    };
  },
  getObject(storageKey) {
    return new Uint8Array(fs.readFileSync(resolvePath(storageKey)));
  },
  deleteObject(storageKey) {
    fs.rmSync(resolvePath(storageKey), { force: true });
  },
  objectExists(storageKey) {
    return fs.existsSync(resolvePath(storageKey));
  },
};

export function getObjectStorage() {
  return localObjectStorage;
}
