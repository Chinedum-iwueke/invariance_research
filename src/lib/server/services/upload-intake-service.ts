import { randomUUID } from "node:crypto";
import type { UploadInspectionResponse } from "@/lib/contracts";
import { accountService } from "@/lib/server/accounts/service";
import { toUploadEligibilitySummary, type ArtifactValidationError } from "@/lib/server/ingestion";
import { parseUploadArtifact } from "@/lib/server/ingestion/parsers";
import { validateFileBasics } from "@/lib/server/ingestion/validators/file";
import { extractZipEntries } from "@/lib/server/ingestion/utils/zip";
import { assertUploadAllowed } from "@/lib/server/entitlements/policy";
import { artifactRepository } from "@/lib/server/repositories/artifact-repository";
import { saveUploadedArtifact } from "@/lib/server/storage/artifact-storage";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export async function inspectUpload(input: {
  fileName: string;
  contentType: string;
  bytes: Uint8Array;
  owner_user_id: string;
  account_id: string;
}): Promise<UploadInspectionResponse> {
  const extension = input.fileName.split(".").pop()?.toLowerCase() ?? "";

  const fileValidation = validateFileBasics(
    {
      fileName: input.fileName,
      extension,
      sizeBytes: input.bytes.byteLength,
      bytes: input.bytes,
    },
    { allowedExtensions: ["csv", "zip"], maxBytes: MAX_UPLOAD_BYTES },
  );

  if (!fileValidation.valid) {
    return failedInspection(fileValidation.errors);
  }

  const contents = extension === "csv" ? Buffer.from(input.bytes).toString("utf-8") : undefined;
  const extractedBundleEntries = extension === "zip" ? safeExtractZipEntries(input.bytes) : undefined;

  if (extension === "zip" && !extractedBundleEntries) {
    return failedInspection([{ code: "invalid_zip_bundle", message: "ZIP bundle could not be extracted" }]);
  }

  const parsedResult = await parseUploadArtifact({
    file: {
      fileName: input.fileName,
      extension,
      sizeBytes: input.bytes.byteLength,
      bytes: input.bytes,
      contents,
    },
    extractedBundleEntries,
  });

  if (!parsedResult.parsed) {
    return failedInspection(
      [{ code: "unsupported_artifact_structure", message: "Unable to parse this artifact structure" }],
      parsedResult.notes,
    );
  }

  if (!parsedResult.parsed.validation.valid) {
    return failedInspection(parsedResult.parsed.validation.errors, [
      ...(parsedResult.parsed.parser_notes ?? []),
      ...parsedResult.notes,
    ]);
  }

  const artifactClass =
    parsedResult.parsed.richness === "research_complete"
      ? "research_bundle"
      : parsedResult.parsed.artifact_kind === "trade_csv"
        ? "trade_csv"
        : "structured_bundle";

  try {
    assertUploadAllowed(input.account_id, artifactClass);
  } catch {
    return failedInspection([{ code: "plan_upload_locked", message: "Current plan does not allow this artifact class." }]);
  }

  const eligibility = toUploadEligibilitySummary(parsedResult.parsed);
  const storage = saveUploadedArtifact(input.fileName, input.bytes, input.contentType || "application/octet-stream");
  const artifactId = randomUUID();

  artifactRepository.save({
    artifact_id: artifactId,
    owner_user_id: input.owner_user_id,
    account_id: input.account_id,
    file_name: input.fileName,
    file_type: input.contentType,
    file_size_bytes: input.bytes.byteLength,
    storage_key: storage.storage_key,
    checksum_sha256: storage.checksum_sha256,
    artifact_kind: parsedResult.parsed.artifact_kind,
    richness: parsedResult.parsed.richness,
    uploaded_at: new Date().toISOString(),
    parsed_artifact: parsedResult.parsed,
    eligibility_summary: eligibility,
  });

  accountService.incrementUsage(input.account_id, "upload");

  return {
    artifact_id: artifactId,
    artifact_kind: parsedResult.parsed.artifact_kind,
    artifact_type: parsedResult.parsed.artifact_type,
    artifact_richness: parsedResult.parsed.richness,
    accepted: eligibility.accepted,
    parser_notes: eligibility.parser_notes,
    validation_errors: parsedResult.parsed.validation.errors,
    diagnostics_available: eligibility.diagnostics_available,
    diagnostics_limited: eligibility.diagnostics_limited,
    diagnostics_unavailable: eligibility.diagnostics_unavailable,
    limitation_reasons: eligibility.limitation_reasons,
    upload_summary_text: eligibility.summary_text,
  };
}

function safeExtractZipEntries(bytes: Uint8Array) {
  try {
    return extractZipEntries(bytes);
  } catch {
    return undefined;
  }
}

function failedInspection(errors: ArtifactValidationError[], parserNotes: string[] = []): UploadInspectionResponse {
  return {
    accepted: false,
    parser_notes: parserNotes,
    validation_errors: errors,
    diagnostics_available: [],
    diagnostics_limited: [],
    diagnostics_unavailable: [],
    limitation_reasons: [],
    upload_summary_text: "Upload rejected during validation.",
  };
}
