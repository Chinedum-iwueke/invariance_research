import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { isAdminIdentity } from "@/lib/server/admin/guards";
import { getServerSession } from "@/lib/server/auth/session";
import { getPublicationById } from "@/lib/server/publications/repository";
import { getObjectStorage, getObjectStorageProvider } from "@/lib/server/storage/object-storage";

const LEGACY_PUBLICATION_ROOT = process.env.INVARIANCE_PUBLICATION_STORAGE_ROOT ?? path.join(process.cwd(), ".data", "publications");

const contentTypeByKind: Record<"pdf" | "cover", string> = {
  pdf: "application/pdf",
  cover: "image/png",
};

async function canAccessUnpublishedPublication() {
  const session = await getServerSession();
  if (!session?.user?.email || !session.user.id) return false;
  return isAdminIdentity({ user_id: session.user.id, email: session.user.email });
}

function resolveLegacyPublicationPath(kind: "pdf" | "cover", fileName: string) {
  return path.join(LEGACY_PUBLICATION_ROOT, kind === "pdf" ? "pdfs" : "covers", fileName.replace(/[^a-zA-Z0-9._-]/g, ""));
}

export async function GET(_: Request, { params }: { params: Promise<{ assetPath: string[] }> }) {
  const { assetPath } = await params;
  const [kind, publicationId, fileName] = assetPath ?? [];
  if (kind !== "pdf" && kind !== "cover") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (publicationId && fileName) {
    const publication = await getPublicationById(publicationId);
    if (!publication) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const canAccess = publication.status === "published" || (await canAccessUnpublishedPublication());
    if (!canAccess) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const storageKey = kind === "pdf" ? publication.pdf_storage_key : publication.cover_storage_key;
    if (!storageKey) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const storage = getObjectStorage();
    const publicUrl = publication.status === "published" ? storage.resolvePublicUrl?.(storageKey) : undefined;
    if (publicUrl) {
      return NextResponse.redirect(publicUrl, { status: 307 });
    }

    const signedUrl = await storage.getSignedReadUrl?.(storageKey, {
      expiresInSeconds: 300,
      fileName,
      contentType: contentTypeByKind[kind],
    });
    if (signedUrl) {
      return NextResponse.redirect(signedUrl, { status: 307 });
    }

    if (getObjectStorageProvider() === "local") {
      const bytes = await storage.getObject(storageKey);
      return new NextResponse(Buffer.from(bytes), {
        headers: {
          "content-type": contentTypeByKind[kind],
          "cache-control": publication.status === "published" ? "public, max-age=3600" : "private, max-age=60",
        },
      });
    }

    return NextResponse.json({ error: "not_available" }, { status: 404 });
  }

  if (!publicationId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const target = resolveLegacyPublicationPath(kind, publicationId);
  try {
    const buffer = await fs.readFile(target);
    return new NextResponse(buffer, {
      headers: {
        "content-type": contentTypeByKind[kind],
        "cache-control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}
