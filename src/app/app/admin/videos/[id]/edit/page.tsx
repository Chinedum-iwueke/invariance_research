import { notFound } from "next/navigation";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { VideoForm } from "@/components/admin/video-form";
import { getVideoById } from "@/lib/server/videos/repository";
export default async function EditVideoPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; const video = getVideoById(id); if (!video) notFound(); return <AdminPageShell title={`Edit: ${video.title}`} description="Update video metadata and publish state."><VideoForm action={`/api/admin/videos/${id}`} video={video} submitLabel="Save changes" /></AdminPageShell>; }
