import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/server/auth/session";
import { getCoreRepositories } from "@/lib/server/persistence/repositories";
import { getObjectStorage, getObjectStorageProvider } from "@/lib/server/storage/object-storage";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const { id } = await params;
  const artifact = await getCoreRepositories().artifacts.findById(id);
  if (!artifact || artifact.account_id !== session.account_id) {
    return NextResponse.json({ error: { code: "not_found", message: "Artifact not found" } }, { status: 404 });
  }

  const storage = getObjectStorage();
  const signedUrl = await storage.getSignedReadUrl?.(artifact.storage_key, {
    expiresInSeconds: 300,
    fileName: artifact.file_name,
    contentType: artifact.file_type || "application/octet-stream",
  });
  if (signedUrl) {
    return NextResponse.redirect(signedUrl, { status: 307 });
  }

  if (getObjectStorageProvider() === "local") {
    const bytes = await storage.getObject(artifact.storage_key);
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "content-type": artifact.file_type || "application/octet-stream",
        "content-disposition": `attachment; filename="${artifact.file_name}"`,
      },
    });
  }

  return NextResponse.json({ error: { code: "not_available", message: "Artifact download unavailable" } }, { status: 404 });
}
