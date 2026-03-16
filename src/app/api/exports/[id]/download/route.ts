import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/server/auth/session";
import { getExportOwned } from "@/lib/server/exports/export-service";
import { getObjectStorage } from "@/lib/server/storage/object-storage";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const { id } = await params;
  const record = getExportOwned(id, session.account_id);

  if (!record || record.status !== "completed" || !record.storage_key) {
    return NextResponse.json({ error: { code: "not_found", message: "Export file not available" } }, { status: 404 });
  }

  if (record.expires_at && record.expires_at <= new Date().toISOString()) {
    return NextResponse.json({ error: { code: "expired", message: "Export expired" } }, { status: 410 });
  }

  const bytes = getObjectStorage().getObject(record.storage_key);
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "content-type": record.content_type ?? "application/octet-stream",
      "content-disposition": `attachment; filename=analysis-${record.analysis_id}.${record.format}`,
      "x-export-checksum-sha256": record.checksum_sha256 ?? "",
    },
  });
}
