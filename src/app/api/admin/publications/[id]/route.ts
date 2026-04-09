import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/server/admin/guards";
import { getPublicationById, parseCategory, parseStatus, storePublicationAsset, updatePublication } from "@/lib/server/publications/repository";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdminSession();
  const { id } = await params;
  const body = await request.formData();
  const intent = String(body.get("intent") ?? "save");

  const existing = getPublicationById(id);
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (intent === "publish" || intent === "unpublish" || intent === "archive") {
    const status = intent === "publish" ? "published" : intent === "archive" ? "archived" : "draft";
    const publishedAt = intent === "publish" ? (existing.published_at ?? new Date().toISOString()) : existing.published_at;
    const updated = updatePublication(id, { status, published_at: publishedAt });
    revalidatePath("/research");
    revalidatePath("/research-standards");
    revalidatePath(`/research/${updated.slug}`);
    return NextResponse.redirect(new URL("/app/admin/publications", request.url));
  }

  const slug = String(body.get("slug") ?? existing.slug).trim();
  const pdf = body.get("pdf_file");
  const cover = body.get("cover_file");

  const pdfAsset = pdf instanceof File && pdf.size > 0 ? await storePublicationAsset({ file: pdf, kind: "pdf", slug }) : undefined;
  const coverAsset = cover instanceof File && cover.size > 0 ? await storePublicationAsset({ file: cover, kind: "cover", slug }) : undefined;

  const publishedAtRaw = String(body.get("published_at") ?? "").trim();
  const updated = updatePublication(id, {
    title: String(body.get("title") ?? existing.title).trim(),
    slug,
    category: parseCategory(String(body.get("category") ?? existing.category)),
    summary: String(body.get("summary") ?? existing.summary).trim(),
    status: parseStatus(String(body.get("status") ?? existing.status)),
    featured: String(body.get("featured") ?? "") === "on",
    published_at: publishedAtRaw ? new Date(publishedAtRaw).toISOString() : null,
    author_label: String(body.get("author_label") ?? "").trim() || undefined,
    estimated_read_time: String(body.get("estimated_read_time") ?? "").trim() || undefined,
    tags: String(body.get("tags") ?? "").split(",").map((item) => item.trim()).filter(Boolean),
    sort_order: String(body.get("sort_order") ?? "").trim() ? Number(body.get("sort_order")) : undefined,
    seo_title: String(body.get("seo_title") ?? "").trim() || undefined,
    seo_description: String(body.get("seo_description") ?? "").trim() || undefined,
    pdf_url: pdfAsset?.public_url ?? existing.pdf_url,
    cover_image_url: coverAsset?.public_url ?? existing.cover_image_url,
  });

  revalidatePath("/research");
  revalidatePath("/research-standards");
  revalidatePath(`/research/${updated.slug}`);
  return NextResponse.redirect(new URL(`/app/admin/publications/${id}/edit`, request.url));
}
