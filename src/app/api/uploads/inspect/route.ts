import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/server/auth/session";
import { getMaxUploadBytesForAccount, inspectUpload } from "@/lib/server/services/upload-intake-service";
import { ObjectStorageConfigurationError, ObjectStorageOperationError } from "@/lib/server/storage/object-storage";
import { enforceRateLimit } from "@/lib/server/rate-limits";

export async function POST(request: Request) {
  const session = await requireServerSession();
  const limited = await enforceRateLimit({ request, route: "upload_inspect", kind: "upload", userId: session.user_id, accountId: session.account_id });
  if (limited) return limited;

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  const maxUploadBytes = await getMaxUploadBytesForAccount(session.account_id);
  if (Number.isFinite(contentLength) && contentLength > maxUploadBytes + 16_384) {
    return NextResponse.json(
      {
        accepted: false,
        parser_notes: [],
        validation_errors: [{ code: "file_too_large", message: `Upload exceeds the ${Math.round(maxUploadBytes / 1024 / 1024)}MB plan limit.` }],
        diagnostics_available: [],
        diagnostics_limited: [],
        diagnostics_unavailable: [],
        limitation_reasons: [],
        upload_summary_text: "Upload rejected because the file is too large.",
      },
      { status: 413 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      {
        accepted: false,
        parser_notes: [],
        validation_errors: [{ code: "empty_file", message: "No file uploaded" }],
        diagnostics_available: [],
        diagnostics_limited: [],
        diagnostics_unavailable: [],
        limitation_reasons: [],
        upload_summary_text: "No file uploaded.",
      },
      { status: 400 },
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const inspection = await inspectUpload({
    fileName: file.name,
    contentType: file.type,
    bytes,
    owner_user_id: session.user_id,
    account_id: session.account_id,
  }).catch((error) => {
    if (error instanceof ObjectStorageConfigurationError || error instanceof ObjectStorageOperationError) {
      return {
        accepted: false,
        parser_notes: [error.message],
        validation_errors: [{ code: "object_storage_unavailable", message: "Object storage is not available." }],
        diagnostics_available: [],
        diagnostics_limited: [],
        diagnostics_unavailable: [],
        limitation_reasons: ["object_storage_unavailable"],
        upload_summary_text: "Upload could not be stored. Object storage is not available.",
      } as const;
    }
    throw error;
  });

  const status = inspection.validation_errors.some((error) => error.code === "object_storage_unavailable") ? 503 : inspection.accepted ? 200 : 422;
  return NextResponse.json(inspection, { status });
}
