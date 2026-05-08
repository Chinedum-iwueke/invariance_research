import { NextResponse } from "next/server";
import { verifyLocalSignedObjectUrl } from "@/lib/server/storage/local-signed-urls";
import { getObjectStorage, getObjectStorageProvider } from "@/lib/server/storage/object-storage";

export async function GET(request: Request) {
  if (getObjectStorageProvider() !== "local") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const payload = url.searchParams.get("payload");
  const signature = url.searchParams.get("sig");
  if (!payload || !signature) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const verified = verifyLocalSignedObjectUrl({ payload, signature });
    const bytes = await getObjectStorage().getObject(verified.storageKey);
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "content-type": verified.contentType ?? "application/octet-stream",
        "content-disposition": verified.fileName ? `attachment; filename="${verified.fileName}"` : "attachment",
        "cache-control": "private, max-age=60",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "invalid_signed_object_url" },
      { status: 403 },
    );
  }
}
