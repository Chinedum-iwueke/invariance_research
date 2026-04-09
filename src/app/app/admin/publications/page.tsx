import Link from "next/link";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { AdminTable } from "@/components/admin/admin-table";
import { listPublications } from "@/lib/server/publications/repository";

export default function AdminPublicationsPage() {
  const publications = listPublications();

  return (
    <AdminPageShell title="Publications" description="Small operational workflow for creating, publishing, and archiving publications.">
      <div className="flex justify-end">
        <Link href="/app/admin/publications/new" className="rounded-sm border border-border-subtle px-3 py-2 text-xs hover:bg-surface-panel">Create publication</Link>
      </div>
      <AdminTable>
        <thead className="border-b bg-surface-panel text-xs uppercase text-text-neutral">
          <tr><th className="px-3 py-2">Title</th><th>Category</th><th>Status</th><th>Published</th><th>Featured</th><th>Source</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {publications.map((item) => (
            <tr key={item.id} className="border-b border-border-subtle/60 text-xs">
              <td className="px-3 py-2">{item.title}<div className="text-text-neutral">/{item.slug}</div></td>
              <td>{item.category}</td>
              <td>{item.status}</td>
              <td>{item.published_at ? item.published_at.slice(0, 10) : "-"}</td>
              <td>{item.featured ? "yes" : "no"}</td>
              <td>{item.source}</td>
              <td className="space-y-1 py-2">
                {item.source === "admin" ? <Link href={`/app/admin/publications/${item.id}/edit`} className="block underline">Edit</Link> : <span className="block text-text-neutral">Manual-only</span>}
                {item.source === "admin" ? (
                  <form method="post" action={`/api/admin/publications/${item.id}`}>
                    <input type="hidden" name="intent" value={item.status === "published" ? "unpublish" : "publish"} />
                    <button className="underline" type="submit">{item.status === "published" ? "Unpublish" : "Publish"}</button>
                  </form>
                ) : null}
                {item.source === "admin" && item.status !== "archived" ? (
                  <form method="post" action={`/api/admin/publications/${item.id}`}>
                    <input type="hidden" name="intent" value="archive" />
                    <button className="underline" type="submit">Archive</button>
                  </form>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </AdminTable>
    </AdminPageShell>
  );
}
