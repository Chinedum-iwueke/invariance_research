import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/server/auth/session";
import { getExportOwned } from "@/lib/server/exports/export-service";
import { getObjectStorage, getObjectStorageProvider } from "@/lib/server/storage/object-storage";

function downloadApiError(error: unknown) {
  const candidate = error as { code?: string; message?: string };
  if (candidate?.code === "XX000" && /max clients reached/i.test(candidate.message ?? "")) {
    return NextResponse.json(
      { error: { code: "database_pool_saturated", message: "Database connection pool is saturated. Please retry in a moment." } },
      { status: 503 },
    );
  }
  if (/SQLite getDb\(\) was called while DATABASE_PROVIDER=postgres/i.test(candidate?.message ?? "")) {
    return NextResponse.json(
      { error: { code: "provider_contract_violation", message: "A server repository used the SQLite path while production is configured for Postgres." } },
      { status: 500 },
    );
  }
  return NextResponse.json(
    { error: { code: "export_download_failed", message: candidate?.message ?? "Export download unavailable." } },
    { status: 500 },
  );
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireServerSession();
    const { id } = await params;
    const record = await getExportOwned(id, session.account_id);

    if (!record || record.status !== "completed" || !record.storage_key) {
      return NextResponse.json({ error: { code: "not_found", message: "Export file not available" } }, { status: 404 });
    }

    if (record.expires_at && record.expires_at <= new Date().toISOString()) {
      return NextResponse.json({ error: { code: "expired", message: "Export expired" } }, { status: 410 });
    }

    const fileName = `analysis-${record.analysis_id}.${record.format}`;
    const storage = getObjectStorage();
    const signedUrl = await storage.getSignedReadUrl?.(record.storage_key, {
      expiresInSeconds: 300,
      fileName,
      contentType: record.content_type ?? "application/octet-stream",
    });
    if (signedUrl) {
      return NextResponse.redirect(signedUrl, { status: 307 });
    }

    if (getObjectStorageProvider() === "local") {
      const bytes = await storage.getObject(record.storage_key);
      return new NextResponse(Buffer.from(bytes), {
        status: 200,
        headers: {
          "content-type": record.content_type ?? "application/octet-stream",
          "content-disposition": `attachment; filename=${fileName}`,
          "x-export-checksum-sha256": record.checksum_sha256 ?? "",
        },
      });
    }

    return NextResponse.json({ error: { code: "not_available", message: "Export file unavailable" } }, { status: 404 });
  } catch (error) {
    return downloadApiError(error);
  }
}
