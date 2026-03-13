import type { ArtifactValidationError, ArtifactValidationResult } from "../contracts";

export type UploadFileDescriptor = {
  fileName: string;
  extension: string;
  sizeBytes: number;
  contents?: string;
  bytes?: Uint8Array;
};

export type FileValidationConfig = {
  allowedExtensions: string[];
  maxBytes: number;
};

export function validateFileBasics(
  file: UploadFileDescriptor,
  config: FileValidationConfig,
): ArtifactValidationResult {
  const errors: ArtifactValidationError[] = [];

  if (!config.allowedExtensions.includes(file.extension.toLowerCase())) {
    errors.push({
      code: "unsupported_file_type",
      message: `Unsupported file extension: ${file.extension}`,
      field: "extension",
    });
  }

  if (file.sizeBytes <= 0) {
    errors.push({ code: "empty_file", message: "Uploaded file is empty" });
  }

  if (file.sizeBytes > config.maxBytes) {
    errors.push({
      code: "file_too_large",
      message: `File is larger than ${config.maxBytes} bytes`,
      field: "sizeBytes",
    });
  }

  if (!file.contents && !file.bytes) {
    errors.push({ code: "unreadable_contents", message: "File contents were not readable" });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: [],
  };
}
