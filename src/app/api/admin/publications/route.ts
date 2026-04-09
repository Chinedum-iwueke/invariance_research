import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/server/admin/guards";
import { createPublication, parseCategory, parseStatus, storePublicationAsset } from "@/lib/server/publications/repository";

export async function POST(request: Request) {
  await requireAdminSession();
  const body = await request.formData();

  const title = String(body.get("title") ?? "").trim();
  const slug = String(body.get("slug") ?? "").trim();
  const summary = String(body.get("summary") ?? "").trim();
  const category = parseCategory(String(body.get("category") ?? "research_note"));
  const status = parseStatus(String(body.get("status") ?? "draft"));
  const featured = String(body.get("featured") ?? "") === "on";
  const publishedAtRaw = String(body.get("published_at") ?? "").trim();
  const publishedAt = publishedAtRaw ? new Date(publishedAtRaw).toISOString() : null;
  const authorLabel = String(body.get("author_label") ?? "").trim() || undefined;
  const estimatedReadTime = String(body.get("estimated_read_time") ?? "").trim() || undefined;
  const tags = String(body.get("tags") ?? "").split(",").map((item) => item.trim()).filter(Boolean);
  const sortOrderRaw = String(body.get("sort_order") ?? "").trim();
  const sortOrder = sortOrderRaw ? Number(sortOrderRaw) : undefined;
  const seoTitle = String(body.get("seo_title") ?? "").trim() || undefined;
  const seoDescription = String(body.get("seo_description") ?? "").trim() || undefined;

  if (!title || !slug || !summary) {
    return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
  }

  const pdf = body.get("pdf_file");
  const cover = body.get("cover_file");
  if (!(pdf instanceof File) || !(cover instanceof File)) {
    return NextResponse.json({ error: "pdf_and_cover_required" }, { status: 400 });
  }

  const [pdfAsset, coverAsset] = await Promise.all([
    storePublicationAsset({ file: pdf, kind: "pdf", slug }),
    storePublicationAsset({ file: cover, kind: "cover", slug }),
  ]);

  const created = createPublication({
    title,
    slug,
    category,
    summary,
    status,
    published_at: publishedAt,
    cover_image_url: coverAsset.public_url,
    pdf_url: pdfAsset.public_url,
    featured,
    author_label: authorLabel,
    estimated_read_time: estimatedReadTime,
    tags,
    sort_order: Number.isFinite(sortOrder) ? sortOrder : undefined,
    seo_title: seoTitle,
    seo_description: seoDescription,
  });

  revalidatePath("/research");
  revalidatePath("/research-standards");
  revalidatePath(`/research/${created.slug}`);
  return NextResponse.redirect(new URL("/app/admin/publications", request.url));
}
