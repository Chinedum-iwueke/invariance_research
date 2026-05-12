import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/server/persistence/database";
import { getDatabaseProvider } from "@/lib/server/persistence/provider";
import { getPostgresPool } from "@/lib/server/persistence/postgres";
import { videoStatuses, videoTracks, type VideoRecord, type VideoStatus, type VideoTrack } from "@/lib/videos/model";

type VideoRow = Omit<VideoRecord, "published_at" | "updated_at"> & {
  published_at: string | Date | null;
  updated_at: string | Date;
};

function fromRow(row: VideoRow): VideoRecord {
  return {
    ...row,
    published_at: row.published_at instanceof Date ? row.published_at.toISOString() : row.published_at,
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
}

export function extractYouTubeVideoId(url: string) { const m = url.trim().match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/); return m?.[1] ?? null; }
export function resolveYouTubeThumbnail(url: string, override?: string | null) { if (override) return override; const id = extractYouTubeVideoId(url); return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null; }
export async function listVideos() {
  if (getDatabaseProvider() === "postgres") {
    const result = await getPostgresPool().query<VideoRow>("SELECT * FROM videos ORDER BY episode_number ASC, COALESCE(published_at, updated_at) DESC");
    return result.rows.map(fromRow);
  }
  return (getDb().prepare("SELECT * FROM videos ORDER BY episode_number ASC, COALESCE(published_at, updated_at) DESC").all() as VideoRow[]).map(fromRow);
}
export async function listPublishedVideos() { return (await listVideos()).filter((v) => v.status === "published"); }
export async function getVideoById(id: string) {
  if (getDatabaseProvider() === "postgres") {
    const result = await getPostgresPool().query<VideoRow>("SELECT * FROM videos WHERE id = $1", [id]);
    return result.rows[0] ? fromRow(result.rows[0]) : undefined;
  }
  const row = getDb().prepare("SELECT * FROM videos WHERE id = ?").get(id) as VideoRow | undefined;
  return row ? fromRow(row) : undefined;
}
export async function createVideo(input: Omit<VideoRecord, "id" | "updated_at">) {
  await ensureUniqueSlug(input.slug);
  const v: VideoRecord = { ...input, id: randomUUID(), updated_at: new Date().toISOString() };
  const values = [v.id, v.title, v.slug, v.description, v.youtube_url, v.category, v.episode_number, v.duration, v.thumbnail_override_url, v.status, v.published_at, v.updated_at];
  if (getDatabaseProvider() === "postgres") {
    await getPostgresPool().query(
      "INSERT INTO videos (id,title,slug,description,youtube_url,category,episode_number,duration,thumbnail_override_url,status,published_at,updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)",
      values,
    );
  } else {
    getDb().prepare("INSERT INTO videos (id,title,slug,description,youtube_url,category,episode_number,duration,thumbnail_override_url,status,published_at,updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(...values);
  }
  return v;
}
export async function updateVideo(id: string, input: Partial<Omit<VideoRecord, "id" | "updated_at">>) {
  const e = await getVideoById(id);
  if (!e) throw new Error("video_not_found");
  if (input.slug && input.slug !== e.slug) await ensureUniqueSlug(input.slug, id);
  const v: VideoRecord = { ...e, ...input, id, updated_at: new Date().toISOString() };
  const values = [v.title, v.slug, v.description, v.youtube_url, v.category, v.episode_number, v.duration, v.thumbnail_override_url, v.status, v.published_at, v.updated_at, id];
  if (getDatabaseProvider() === "postgres") {
    await getPostgresPool().query(
      "UPDATE videos SET title=$1,slug=$2,description=$3,youtube_url=$4,category=$5,episode_number=$6,duration=$7,thumbnail_override_url=$8,status=$9,published_at=$10,updated_at=$11 WHERE id=$12",
      values,
    );
  } else {
    getDb().prepare("UPDATE videos SET title=?,slug=?,description=?,youtube_url=?,category=?,episode_number=?,duration=?,thumbnail_override_url=?,status=?,published_at=?,updated_at=? WHERE id=?").run(...values);
  }
  return v;
}
async function ensureUniqueSlug(slug: string, existingId?: string) {
  const r =
    getDatabaseProvider() === "postgres"
      ? (await getPostgresPool().query<{ id?: string }>("SELECT id FROM videos WHERE slug=$1", [slug])).rows[0]
      : (getDb().prepare("SELECT id FROM videos WHERE slug=?").get(slug) as {id?:string}|undefined);
  if (r?.id && r.id !== existingId) throw new Error("slug_conflict");
}
export function parseVideoTrack(input: string) { if (!videoTracks.includes(input as VideoTrack)) throw new Error("invalid_track"); return input as VideoTrack; }
export function parseVideoStatus(input: string) { if (!videoStatuses.includes(input as VideoStatus)) throw new Error("invalid_status"); return input as VideoStatus; }
