import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { writeAdminAuditLog } from "@/lib/server/admin/audit-log";
import { requireAdminSession } from "@/lib/server/admin/guards";
import { assertSameOrigin } from "@/lib/server/auth/security";
import { getVideoById, parseVideoStatus, parseVideoTrack, updateVideo } from "@/lib/server/videos/repository";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  assertSameOrigin(request);
  const actor = await requireAdminSession();
  const { id } = await params;
  const existing = await getVideoById(id);
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await request.formData();
  const updated = await updateVideo(id, {
    title: String(body.get("title") ?? existing.title).trim(),
    slug: String(body.get("slug") ?? existing.slug).trim(),
    description: String(body.get("description") ?? existing.description).trim(),
    youtube_url: String(body.get("youtube_url") ?? existing.youtube_url).trim(),
    category: parseVideoTrack(String(body.get("category") ?? existing.category)),
    episode_number: Number(body.get("episode_number") ?? existing.episode_number),
    duration: String(body.get("duration") ?? "").trim() || null,
    thumbnail_override_url: String(body.get("thumbnail_override_url") ?? "").trim() || null,
    status: parseVideoStatus(String(body.get("status") ?? existing.status)),
    published_at: String(body.get("published_at") ?? "").trim() ? new Date(String(body.get("published_at"))).toISOString() : null,
  });

  revalidatePath("/research");
  await writeAdminAuditLog({
    actor,
    action: updated.status !== existing.status && updated.status === "published" ? "video.publish" : updated.status !== existing.status && existing.status === "published" ? "video.unpublish" : "video.update",
    resourceType: "video",
    resourceId: updated.id,
    metadata: { previous_status: existing.status, status: updated.status, slug: updated.slug },
    request,
  });
  return NextResponse.redirect(new URL(`/app/admin/videos/${updated.id}/edit`, request.url));
}
