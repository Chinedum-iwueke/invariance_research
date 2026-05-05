import type { VideoRecord } from "@/lib/videos/model";
export function VideoForm({ action, video, submitLabel }: { action: string; video?: VideoRecord; submitLabel: string }) {
  const publishedAtValue = video?.published_at ? video.published_at.slice(0, 10) : "";
  return <form action={action} method="post" className="grid gap-4 rounded-sm border border-border-subtle bg-surface-white p-4">
    <label className="grid gap-1 text-xs">Title<input className="rounded-sm border px-3 py-2 text-sm" name="title" defaultValue={video?.title} required /></label>
    <label className="grid gap-1 text-xs">Slug<input className="rounded-sm border px-3 py-2 text-sm" name="slug" defaultValue={video?.slug} required /></label>
    <label className="grid gap-1 text-xs">Description<textarea className="rounded-sm border px-3 py-2 text-sm" rows={4} name="description" defaultValue={video?.description} required /></label>
    <label className="grid gap-1 text-xs">YouTube URL<input className="rounded-sm border px-3 py-2 text-sm" name="youtube_url" defaultValue={video?.youtube_url} required /></label>
    <div className="grid gap-4 md:grid-cols-2">
      <label className="grid gap-1 text-xs">Track<select className="rounded-sm border px-3 py-2 text-sm" name="category" defaultValue={video?.category ?? "strategy_foundations"}><option value="strategy_foundations">strategy_foundations</option><option value="execution_microstructure">execution_microstructure</option><option value="robustness_risk">robustness_risk</option><option value="research_workflow">research_workflow</option><option value="advanced_diagnostics">advanced_diagnostics</option></select></label>
      <label className="grid gap-1 text-xs">Episode Number<input type="number" className="rounded-sm border px-3 py-2 text-sm" name="episode_number" defaultValue={video?.episode_number ?? 1} required /></label>
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      <label className="grid gap-1 text-xs">Duration<input className="rounded-sm border px-3 py-2 text-sm" name="duration" defaultValue={video?.duration ?? ""} /></label>
      <label className="grid gap-1 text-xs">Thumbnail Override URL<input className="rounded-sm border px-3 py-2 text-sm" name="thumbnail_override_url" defaultValue={video?.thumbnail_override_url ?? ""} /></label>
    </div>
    <div className="grid gap-4 md:grid-cols-2"><label className="grid gap-1 text-xs">Status<select className="rounded-sm border px-3 py-2 text-sm" name="status" defaultValue={video?.status ?? "draft"}><option value="draft">draft</option><option value="published">published</option></select></label><label className="grid gap-1 text-xs">Published At<input type="date" className="rounded-sm border px-3 py-2 text-sm" name="published_at" defaultValue={publishedAtValue} /></label></div>
    <button type="submit" className="w-fit rounded-sm border border-border-subtle px-4 py-2 text-sm hover:bg-surface-panel">{submitLabel}</button>
  </form>;
}
