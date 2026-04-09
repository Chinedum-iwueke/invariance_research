import fs from "node:fs";
import { NextResponse } from "next/server";
import { resolvePublicationAssetPath } from "@/lib/server/publications/repository";

const contentTypeByKind: Record<"pdf" | "cover", string> = {
  pdf: "application/pdf",
  cover: "image/png",
};

export async function GET(_: Request, { params }: { params: Promise<{ assetPath: string[] }> }) {
  const { assetPath } = await params;
  const [kind, fileName] = assetPath ?? [];
  if ((kind !== "pdf" && kind !== "cover") || !fileName) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const safeFile = fileName.replace(/[^a-zA-Z0-9._-]/g, "");
  const target = resolvePublicationAssetPath(kind, safeFile);
  if (!fs.existsSync(target)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const buffer = fs.readFileSync(target);
  return new NextResponse(buffer, {
    headers: {
      "content-type": contentTypeByKind[kind],
      "cache-control": "public, max-age=3600",
    },
  });
}
