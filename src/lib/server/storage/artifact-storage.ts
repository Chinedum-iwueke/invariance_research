import { getObjectStorage } from "@/lib/server/storage/object-storage";

export function saveUploadedArtifact(fileName: string, bytes: Uint8Array, contentType = "application/octet-stream") {
  return getObjectStorage().putObject({
    bucket: "uploads",
    file_name: fileName,
    bytes,
    content_type: contentType,
  });
}

export function readArtifact(storageKey: string): Uint8Array {
  return getObjectStorage().getObject(storageKey);
}

export function deleteArtifact(storageKey: string): void {
  getObjectStorage().deleteObject(storageKey);
}
