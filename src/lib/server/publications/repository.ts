import { randomUUID } from "node:crypto";
import path from "node:path";
import { getDb } from "@/lib/server/persistence/database";
import { getDatabaseProvider } from "@/lib/server/persistence/provider";
import { getPostgresPool } from "@/lib/server/persistence/postgres";
import { manualPublications } from "@/content/publications";
import { publicationCategories, publicationStatuses, type PublicationCategory, type PublicationInput, type PublicationRecord, type PublicationStatus } from "@/lib/publications/model";
import { getObjectStorage } from "@/lib/server/storage/object-storage";
import { buildPublicationCoverObjectKey, buildPublicationObjectKey } from "@/lib/server/storage/object-keys";
import { toCanonicalPublication } from "@/lib/publications/urls";

type PublicationRow = {
  id: string;
  title: string;
  slug: string;
  category: PublicationCategory;
  summary: string;
  status: PublicationStatus;
  published_at: string | Date | null;
  updated_at: string | Date;
  cover_image_url: string;
  pdf_url: string;
  cover_storage_key: string | null;
  pdf_storage_key: string | null;
  viewer_url: string | null;
  featured: number | boolean;
  author_label: string | null;
  estimated_read_time: string | null;
  tags_json: string[] | string | null;
  sort_order: number | null;
  seo_title: string | null;
  seo_description: string | null;
};

function toIsoString(value: string | Date | null) {
  return value instanceof Date ? value.toISOString() : value;
}

function fromRow(row: PublicationRow): PublicationRecord {
  const tags = Array.isArray(row.tags_json) ? row.tags_json : row.tags_json ? (JSON.parse(row.tags_json) as string[]) : undefined;
  return toCanonicalPublication({
    id: row.id,
    title: row.title,
    slug: row.slug,
    category: row.category,
    summary: row.summary,
    status: row.status,
    published_at: toIsoString(row.published_at),
    updated_at: toIsoString(row.updated_at) ?? new Date().toISOString(),
    cover_image_url: row.cover_image_url,
    pdf_url: row.pdf_url,
    cover_storage_key: row.cover_storage_key ?? undefined,
    pdf_storage_key: row.pdf_storage_key ?? undefined,
    viewer_url: row.viewer_url ?? undefined,
    featured: row.featured === true || row.featured === 1,
    author_label: row.author_label ?? undefined,
    estimated_read_time: row.estimated_read_time ?? undefined,
    tags,
    sort_order: row.sort_order ?? undefined,
    seo_title: row.seo_title ?? undefined,
    seo_description: row.seo_description ?? undefined,
    source: "admin",
  });
}

async function listAdminRows() {
  if (getDatabaseProvider() === "postgres") {
    const result = await getPostgresPool().query<PublicationRow>(
      "SELECT * FROM publications ORDER BY COALESCE(sort_order, 999999) ASC, COALESCE(published_at, updated_at) DESC",
    );
    return result.rows;
  }
  return getDb().prepare("SELECT * FROM publications ORDER BY COALESCE(sort_order, 999999) ASC, COALESCE(published_at, updated_at) DESC").all() as PublicationRow[];
}

export async function listPublications() {
  const admin = (await listAdminRows()).map(fromRow);
  const manual = manualPublications.map((item) => toCanonicalPublication({ ...item, source: "manual" }));
  return [...admin, ...manual].sort((a, b) => {
    const aOrder = a.sort_order ?? 999999;
    const bOrder = b.sort_order ?? 999999;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return (b.published_at ?? b.updated_at).localeCompare(a.published_at ?? a.updated_at);
  });
}

export async function listPublishedPublications() {
  return (await listPublications()).filter((item) => item.status === "published");
}

export async function getPublicationBySlug(slug: string) {
  return (await listPublications()).find((item) => item.slug === slug);
}

export async function resolveActiveResearchStandard() {
  const standards = (await listPublications()).filter((item) => item.category === "research_standard" && item.status === "published");
  return standards.sort((a, b) => (b.published_at ?? b.updated_at).localeCompare(a.published_at ?? a.updated_at))[0];
}

export async function createPublication(input: Omit<PublicationInput, "updated_at" | "viewer_url" | "source"> & { id?: string }) {
  const publicationId = input.id ?? randomUUID();
  await ensureUniqueSlug(input.slug, publicationId);
  const now = new Date().toISOString();
  const publication = toCanonicalPublication({
    ...input,
    id: publicationId,
    updated_at: now,
    source: "admin",
  });

  const values = [
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
    publication.cover_storage_key ?? null,
    publication.pdf_storage_key ?? null,
    publication.viewer_url,
    publication.featured,
    publication.author_label ?? null,
    publication.estimated_read_time ?? null,
    publication.tags?.length ? JSON.stringify(publication.tags) : null,
    publication.sort_order ?? null,
    publication.seo_title ?? null,
    publication.seo_description ?? null,
  ];

  if (getDatabaseProvider() === "postgres") {
    await getPostgresPool().query(
      `INSERT INTO publications (id, title, slug, category, summary, status, published_at, updated_at, cover_image_url, pdf_url, cover_storage_key, pdf_storage_key, viewer_url, featured, author_label, estimated_read_time, tags_json, sort_order, seo_title, seo_description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb, $18, $19, $20)`,
      values,
    );
  } else {
    getDb()
      .prepare(`INSERT INTO publications (id, title, slug, category, summary, status, published_at, updated_at, cover_image_url, pdf_url, cover_storage_key, pdf_storage_key, viewer_url, featured, author_label, estimated_read_time, tags_json, sort_order, seo_title, seo_description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(...values.map((value, index) => (index === 13 ? (value ? 1 : 0) : typeof value === "boolean" ? (value ? 1 : 0) : value)));
  }

  return publication;
}

export async function updatePublication(id: string, input: Partial<Omit<PublicationInput, "id" | "source" | "updated_at">>) {
  const existing = await getPublicationById(id);
  if (!existing) throw new Error("publication_not_found");
  if (input.slug && input.slug !== existing.slug) {
    await ensureUniqueSlug(input.slug, existing.id);
  }

  const merged = toCanonicalPublication({
    ...existing,
    ...input,
    id,
    updated_at: new Date().toISOString(),
    source: "admin",
  });

  const values = [
    merged.title,
    merged.slug,
    merged.category,
    merged.summary,
    merged.status,
    merged.published_at,
    merged.updated_at,
    merged.cover_image_url,
    merged.pdf_url,
    merged.cover_storage_key ?? null,
    merged.pdf_storage_key ?? null,
    merged.viewer_url,
    merged.featured,
    merged.author_label ?? null,
    merged.estimated_read_time ?? null,
    merged.tags?.length ? JSON.stringify(merged.tags) : null,
    merged.sort_order ?? null,
    merged.seo_title ?? null,
    merged.seo_description ?? null,
    id,
  ];

  if (getDatabaseProvider() === "postgres") {
    await getPostgresPool().query(
      `UPDATE publications SET title = $1, slug = $2, category = $3, summary = $4, status = $5, published_at = $6, updated_at = $7, cover_image_url = $8, pdf_url = $9, cover_storage_key = $10, pdf_storage_key = $11, viewer_url = $12, featured = $13, author_label = $14, estimated_read_time = $15, tags_json = $16::jsonb, sort_order = $17, seo_title = $18, seo_description = $19 WHERE id = $20`,
      values,
    );
  } else {
    getDb()
      .prepare(`UPDATE publications SET title = ?, slug = ?, category = ?, summary = ?, status = ?, published_at = ?, updated_at = ?, cover_image_url = ?, pdf_url = ?, cover_storage_key = ?, pdf_storage_key = ?, viewer_url = ?, featured = ?, author_label = ?, estimated_read_time = ?, tags_json = ?, sort_order = ?, seo_title = ?, seo_description = ? WHERE id = ?`)
      .run(...values.map((value, index) => (index === 12 ? (value ? 1 : 0) : typeof value === "boolean" ? (value ? 1 : 0) : value)));
  }

  return merged;
}

export async function getPublicationById(id: string) {
  if (getDatabaseProvider() === "postgres") {
    const result = await getPostgresPool().query<PublicationRow>("SELECT * FROM publications WHERE id = $1", [id]);
    const row = result.rows[0];
    return row ? fromRow(row) : undefined;
  }
  const row = getDb().prepare("SELECT * FROM publications WHERE id = ?").get(id) as PublicationRow | undefined;
  return row ? fromRow(row) : undefined;
}

async function ensureUniqueSlug(slug: string, existingId?: string) {
  const fromDb =
    getDatabaseProvider() === "postgres"
      ? (await getPostgresPool().query<{ id?: string }>("SELECT id FROM publications WHERE slug = $1", [slug])).rows[0]
      : (getDb().prepare("SELECT id FROM publications WHERE slug = ?").get(slug) as { id?: string } | undefined);
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

export function buildPublicationAssetUrl(input: { kind: "pdf" | "cover"; publicationId: string; fileName: string }) {
  return `/api/publications/assets/${input.kind}/${input.publicationId}/${safePathPart(input.fileName)}`;
}

export async function storePublicationAsset(input: { file: File; kind: "pdf" | "cover"; slug: string; publicationId: string }) {
  const ext = path.extname(input.file.name) || (input.kind === "pdf" ? ".pdf" : ".png");
  const fileName = `${safePathPart(input.slug)}${ext}`;
  const storageKey =
    input.kind === "pdf"
      ? buildPublicationObjectKey({ publicationId: input.publicationId, fileName })
      : buildPublicationCoverObjectKey({ publicationId: input.publicationId, fileName });
  const buffer = new Uint8Array(await input.file.arrayBuffer());
  const stored = await getObjectStorage().putObject({
    bucket: input.kind === "pdf" ? "publications" : "publication-covers",
    file_name: fileName,
    bytes: buffer,
    content_type: input.file.type || (input.kind === "pdf" ? "application/pdf" : "image/png"),
    storage_key: storageKey,
  });
  return {
    file_name: fileName,
    storage_key: stored.storage_key,
    public_url: buildPublicationAssetUrl({ kind: input.kind, publicationId: input.publicationId, fileName }),
  };
}

export async function listResearchLibrary() {
  const published = await listPublishedPublications();
  return {
    featured: published.filter((item) => item.featured),
    collection: published,
    taxonomy: ["execution", "robustness", "capital risk", "research standards", "case study", "research note"],
  };
}
