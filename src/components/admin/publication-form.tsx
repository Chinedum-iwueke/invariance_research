import type { PublicationRecord } from "@/lib/publications/model";

type PublicationFormProps = {
  action: string;
  publication?: PublicationRecord;
  submitLabel: string;
};

export function PublicationForm({ action, publication, submitLabel }: PublicationFormProps) {
  const publishedAtValue = publication?.published_at ? publication.published_at.slice(0, 10) : "";
  return (
    <form action={action} method="post" encType="multipart/form-data" className="grid gap-4 rounded-sm border border-border-subtle bg-surface-white p-4">
      <label className="grid gap-1 text-xs">Title<input className="rounded-sm border px-3 py-2 text-sm" name="title" defaultValue={publication?.title} required /></label>
      <label className="grid gap-1 text-xs">Slug<input className="rounded-sm border px-3 py-2 text-sm" name="slug" defaultValue={publication?.slug} required /></label>
      <label className="grid gap-1 text-xs">Category
        <select className="rounded-sm border px-3 py-2 text-sm" name="category" defaultValue={publication?.category ?? "research_note"}>
          <option value="research_standard">research_standard</option>
          <option value="case_study">case_study</option>
          <option value="research_note">research_note</option>
        </select>
      </label>
      <label className="grid gap-1 text-xs">Summary<textarea className="rounded-sm border px-3 py-2 text-sm" name="summary" rows={4} defaultValue={publication?.summary} required /></label>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1 text-xs">Status
          <select className="rounded-sm border px-3 py-2 text-sm" name="status" defaultValue={publication?.status ?? "draft"}>
            <option value="draft">draft</option>
            <option value="published">published</option>
            <option value="archived">archived</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs">Published At<input type="date" className="rounded-sm border px-3 py-2 text-sm" name="published_at" defaultValue={publishedAtValue} /></label>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1 text-xs">Author Label<input className="rounded-sm border px-3 py-2 text-sm" name="author_label" defaultValue={publication?.author_label} /></label>
        <label className="grid gap-1 text-xs">Estimated Read Time<input className="rounded-sm border px-3 py-2 text-sm" name="estimated_read_time" defaultValue={publication?.estimated_read_time} /></label>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1 text-xs">Tags (comma-separated)<input className="rounded-sm border px-3 py-2 text-sm" name="tags" defaultValue={publication?.tags?.join(", ")} /></label>
        <label className="grid gap-1 text-xs">Sort Order<input type="number" className="rounded-sm border px-3 py-2 text-sm" name="sort_order" defaultValue={publication?.sort_order} /></label>
      </div>
      <label className="grid gap-1 text-xs">SEO Title<input className="rounded-sm border px-3 py-2 text-sm" name="seo_title" defaultValue={publication?.seo_title} /></label>
      <label className="grid gap-1 text-xs">SEO Description<input className="rounded-sm border px-3 py-2 text-sm" name="seo_description" defaultValue={publication?.seo_description} /></label>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1 text-xs">Cover Image (PNG/JPG)<input className="rounded-sm border px-3 py-2 text-sm" type="file" name="cover_file" accept="image/*" required={!publication} /></label>
        <label className="grid gap-1 text-xs">PDF File<input className="rounded-sm border px-3 py-2 text-sm" type="file" name="pdf_file" accept="application/pdf" required={!publication} /></label>
      </div>
      <label className="inline-flex items-center gap-2 text-xs font-medium"><input type="checkbox" name="featured" defaultChecked={publication?.featured} />Featured publication</label>
      <button type="submit" className="w-fit rounded-sm border border-border-subtle px-4 py-2 text-sm hover:bg-surface-panel">{submitLabel}</button>
    </form>
  );
}
