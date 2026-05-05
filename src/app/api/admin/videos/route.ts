import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/server/admin/guards";
import { createVideo, parseVideoStatus, parseVideoTrack } from "@/lib/server/videos/repository";

export async function POST(request: Request){ await requireAdminSession(); const body = await request.formData(); createVideo({
 title:String(body.get("title")??"").trim(), slug:String(body.get("slug")??"").trim(), description:String(body.get("description")??"").trim(), youtube_url:String(body.get("youtube_url")??"").trim(), category:parseVideoTrack(String(body.get("category")??"strategy_foundations")), episode_number:Number(body.get("episode_number") ?? 1), duration:String(body.get("duration")??"").trim()||null, thumbnail_override_url:String(body.get("thumbnail_override_url")??"").trim()||null, status:parseVideoStatus(String(body.get("status")??"draft")), published_at:String(body.get("published_at")??"").trim()? new Date(String(body.get("published_at"))).toISOString() : null,
 }); revalidatePath('/research'); return NextResponse.redirect(new URL('/app/admin/videos', request.url)); }
