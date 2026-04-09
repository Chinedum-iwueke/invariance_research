import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getDb } from "@/lib/server/persistence/database";
import { manualPublications } from "@/content/publications";
import { publicationCategories, publicationStatuses, type PublicationCategory, type PublicationInput, type PublicationRecord, type PublicationStatus } from "@/lib/publications/model";
import { toCanonicalPublication } from "@/lib/publications/urls";

const PUBLICATION_ROOT = process.env.INVARIANCE_PUBLICATION_STORAGE_ROOT ?? path.join(process.cwd(), ".data", "publications");

type PublicationRow = {
  id: string;
  title: string;
  slug: string;
  category: PublicationCategory;
  summary: string;
  status: PublicationStatus;
  published_at: string | null;
  updated_at: string;
  cover_image_url: string;
  pdf_url: string;
  viewer_url: string | null;
  featured: number;
  author_label: string | null;
  estimated_read_time: string | null;
  tags_json: string | null;
  sort_order: number | null;
  seo_title: string | null;
  seo_description: string | null;
};

function fromRow(row: PublicationRow): PublicationRecord {
  return toCanonicalPublication({
    id: row.id,
    title: row.title,
    slug: row.slug,
    category: row.category,
    summary: row.summary,
    status: row.status,
    published_at: row.published_at,
    updated_at: row.updated_at,
    cover_image_url: row.cover_image_url,
    pdf_url: row.pdf_url,
    viewer_url: row.viewer_url ?? undefined,
    featured: Boolean(row.featured),
    author_label: row.author_label ?? undefined,
    estimated_read_time: row.estimated_read_time ?? undefined,
    tags: row.tags_json ? (JSON.parse(row.tags_json) as string[]) : undefined,
    sort_order: row.sort_order ?? undefined,
    seo_title: row.seo_title ?? undefined,
    seo_description: row.seo_description ?? undefined,
    source: "admin",
  });
}

function listAdminRows() {
  return getDb().prepare("SELECT * FROM publications ORDER BY COALESCE(sort_order, 999999) ASC, COALESCE(published_at, updated_at) DESC").all() as PublicationRow[];
}

export function listPublications() {
  const admin = listAdminRows().map(fromRow);
  const manual = manualPublications.map((item) => toCanonicalPublication({ ...item, source: "manual" }));
  return [...admin, ...manual].sort((a, b) => {
    const aOrder = a.sort_order ?? 999999;
    const bOrder = b.sort_order ?? 999999;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return (b.published_at ?? b.updated_at).localeCompare(a.published_at ?? a.updated_at);
  });
}

export function listPublishedPublications() {
  return listPublications().filter((item) => item.status === "published");
}

export function getPublicationBySlug(slug: string) {
  return listPublications().find((item) => item.slug === slug);
}

export function resolveActiveResearchStandard() {
  const standards = listPublications().filter((item) => item.category === "research_standard" && item.status === "published");
  return standards.sort((a, b) => (b.published_at ?? b.updated_at).localeCompare(a.published_at ?? a.updated_at))[0];
}

export function createPublication(input: Omit<PublicationInput, "id" | "updated_at" | "viewer_url" | "source">) {
  ensureUniqueSlug(input.slug);
  const now = new Date().toISOString();
  const publication = toCanonicalPublication({
    ...input,
    id: randomUUID(),
    updated_at: now,
    source: "admin",
  });

  getDb()
    .prepare(`INSERT INTO publications (id, title, slug, category, summary, status, published_at, updated_at, cover_image_url, pdf_url, viewer_url, featured, author_label, estimated_read_time, tags_json, sort_order, seo_title, seo_description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      publication.id,
      publication.title,
      publication.slug,
      publication.category,
      publication.summary,
      publication.status,
      publication.published_at,
      publication.updated_at,
      publication.cover_image_url,
      publication.pdf_url,
      publication.viewer_url,
      publication.featured ? 1 : 0,
      publication.author_label ?? null,
      publication.estimated_read_time ?? null,
      publication.tags?.length ? JSON.stringify(publication.tags) : null,
      publication.sort_order ?? null,
      publication.seo_title ?? null,
      publication.seo_description ?? null,
    );

  return publication;
}

export function updatePublication(id: string, input: Partial<Omit<PublicationInput, "id" | "source" | "updated_at">>) {
  const existing = getPublicationById(id);
  if (!existing) throw new Error("publication_not_found");
  if (input.slug && input.slug !== existing.slug) {
    ensureUniqueSlug(input.slug, existing.id);
  }

  const merged = toCanonicalPublication({
    ...existing,
    ...input,
    id,
    updated_at: new Date().toISOString(),
    source: "admin",
  });

  getDb()
    .prepare(`UPDATE publications SET title = ?, slug = ?, category = ?, summary = ?, status = ?, published_at = ?, updated_at = ?, cover_image_url = ?, pdf_url = ?, viewer_url = ?, featured = ?, author_label = ?, estimated_read_time = ?, tags_json = ?, sort_order = ?, seo_title = ?, seo_description = ? WHERE id = ?`)
    .run(
      merged.title,
      merged.slug,
      merged.category,
      merged.summary,
      merged.status,
      merged.published_at,
      merged.updated_at,
      merged.cover_image_url,
      merged.pdf_url,
      merged.viewer_url,
      merged.featured ? 1 : 0,
      merged.author_label ?? null,
      merged.estimated_read_time ?? null,
      merged.tags?.length ? JSON.stringify(merged.tags) : null,
      merged.sort_order ?? null,
      merged.seo_title ?? null,
      merged.seo_description ?? null,
      id,
    );

  return merged;
}

export function getPublicationById(id: string) {
  const row = getDb().prepare("SELECT * FROM publications WHERE id = ?").get(id) as PublicationRow | undefined;
  return row ? fromRow(row) : undefined;
}

function ensureUniqueSlug(slug: string, existingId?: string) {
  const fromDb = getDb().prepare("SELECT id FROM publications WHERE slug = ?").get(slug) as { id?: string } | undefined;
  if (fromDb?.id && fromDb.id !== existingId) throw new Error("slug_conflict");
  const fromManual = manualPublications.find((item) => item.slug === slug && item.id !== existingId);
  if (fromManual) throw new Error("slug_conflict");
}

export function parseCategory(input: string): PublicationCategory {
  if (!publicationCategories.includes(input as PublicationCategory)) throw new Error("invalid_category");
  return input as PublicationCategory;
}

export function parseStatus(input: string): PublicationStatus {
  if (!publicationStatuses.includes(input as PublicationStatus)) throw new Error("invalid_status");
  return input as PublicationStatus;
}

function safePathPart(input: string) {
  return input.replace(/[^a-zA-Z0-9._-]/g, "-");
}

export function storePublicationAsset(input: { file: File; kind: "pdf" | "cover"; slug: string }) {
  const ext = path.extname(input.file.name) || (input.kind === "pdf" ? ".pdf" : ".png");
  const fileName = `${safePathPart(input.slug)}${ext}`;
  const dir = path.join(PUBLICATION_ROOT, input.kind === "pdf" ? "pdfs" : "covers");
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, fileName);
  return input.file.arrayBuffer().then((buffer) => {
    fs.writeFileSync(filePath, Buffer.from(buffer));
    return {
      absolute_path: filePath,
      public_url: `/api/publications/assets/${input.kind}/${fileName}`,
    };
  });
}

export function resolvePublicationAssetPath(kind: "pdf" | "cover", fileName: string) {
  return path.join(PUBLICATION_ROOT, kind === "pdf" ? "pdfs" : "covers", fileName);
}

export function listResearchLibrary() {
  const published = listPublishedPublications();
  return {
    featured: published.filter((item) => item.featured && item.category !== "research_standard"),
    collection: published.filter((item) => item.category !== "research_standard"),
    taxonomy: ["execution", "robustness", "capital risk", "case study", "research note"],
  };
}
