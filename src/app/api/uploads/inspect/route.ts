import { NextResponse } from "next/server";
import { inspectUpload } from "@/lib/server/services/upload-intake-service";

export async function POST(request: Request) {
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
  });

  return NextResponse.json(inspection, { status: inspection.accepted ? 200 : 422 });
}
