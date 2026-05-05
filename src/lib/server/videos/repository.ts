import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/server/persistence/database";
import { videoStatuses, videoTracks, type VideoRecord, type VideoStatus, type VideoTrack } from "@/lib/videos/model";

type VideoRow = VideoRecord;
export function extractYouTubeVideoId(url: string) { const m = url.trim().match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/); return m?.[1] ?? null; }
export function resolveYouTubeThumbnail(url: string, override?: string | null) { if (override) return override; const id = extractYouTubeVideoId(url); return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null; }
export function listVideos() { return getDb().prepare("SELECT * FROM videos ORDER BY episode_number ASC, COALESCE(published_at, updated_at) DESC").all() as VideoRow[]; }
export function listPublishedVideos() { return listVideos().filter((v) => v.status === "published"); }
export function getVideoById(id: string) { return getDb().prepare("SELECT * FROM videos WHERE id = ?").get(id) as VideoRow | undefined; }
export function createVideo(input: Omit<VideoRecord, "id" | "updated_at">) { ensureUniqueSlug(input.slug); const v: VideoRecord = { ...input, id: randomUUID(), updated_at: new Date().toISOString() }; getDb().prepare("INSERT INTO videos (id,title,slug,description,youtube_url,category,episode_number,duration,thumbnail_override_url,status,published_at,updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(v.id,v.title,v.slug,v.description,v.youtube_url,v.category,v.episode_number,v.duration,v.thumbnail_override_url,v.status,v.published_at,v.updated_at); return v; }
export function updateVideo(id: string, input: Partial<Omit<VideoRecord, "id" | "updated_at">>) { const e = getVideoById(id); if (!e) throw new Error("video_not_found"); if (input.slug && input.slug !== e.slug) ensureUniqueSlug(input.slug, id); const v: VideoRecord = { ...e, ...input, id, updated_at: new Date().toISOString() }; getDb().prepare("UPDATE videos SET title=?,slug=?,description=?,youtube_url=?,category=?,episode_number=?,duration=?,thumbnail_override_url=?,status=?,published_at=?,updated_at=? WHERE id=?").run(v.title,v.slug,v.description,v.youtube_url,v.category,v.episode_number,v.duration,v.thumbnail_override_url,v.status,v.published_at,v.updated_at,id); return v; }
function ensureUniqueSlug(slug: string, existingId?: string) { const r = getDb().prepare("SELECT id FROM videos WHERE slug=?").get(slug) as {id?:string}|undefined; if (r?.id && r.id !== existingId) throw new Error("slug_conflict"); }
export function parseVideoTrack(input: string) { if (!videoTracks.includes(input as VideoTrack)) throw new Error("invalid_track"); return input as VideoTrack; }
export function parseVideoStatus(input: string) { if (!videoStatuses.includes(input as VideoStatus)) throw new Error("invalid_status"); return input as VideoStatus; }
