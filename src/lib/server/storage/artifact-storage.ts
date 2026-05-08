import { getObjectStorage } from "@/lib/server/storage/object-storage";
import { buildUploadObjectKey } from "@/lib/server/storage/object-keys";

export function saveUploadedArtifact(input: {
  accountId: string;
  artifactId: string;
  fileName: string;
  bytes: Uint8Array;
  contentType?: string;
}) {
  return getObjectStorage().putObject({
    bucket: "uploads",
    file_name: input.fileName,
    bytes: input.bytes,
    content_type: input.contentType ?? "application/octet-stream",
    storage_key: buildUploadObjectKey({
      accountId: input.accountId,
      artifactId: input.artifactId,
      fileName: input.fileName,
    }),
  });
}

export function readArtifact(storageKey: string) {
  return getObjectStorage().getObject(storageKey);
}

export function deleteArtifact(storageKey: string) {
  return getObjectStorage().deleteObject(storageKey);
}
