import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { VideoForm } from "@/components/admin/video-form";
export default function NewVideoPage(){return <AdminPageShell title="Create video" description="Add a YouTube episode to the research library."><VideoForm action="/api/admin/videos" submitLabel="Create video" /></AdminPageShell>}
