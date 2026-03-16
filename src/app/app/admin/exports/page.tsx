import Link from "next/link";
import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { AdminTable } from "@/components/admin/admin-table";
import { ExportStatusBadge } from "@/components/admin/status-badges";
import { listAdminExports } from "@/lib/server/admin/exports-service";

export default async function AdminExportsPage({ searchParams }: { searchParams: Promise<{ filter?: "failed" | "expired" | "recent" }> }) {
  const params = await searchParams;
  const view = listAdminExports(params.filter);

  return (
    <AdminPageShell title="Exports Dashboard" description="Export lifecycle, storage metadata, and retry/cleanup controls.">
      <div className="grid gap-3 md:grid-cols-4">
        <AdminStatCard label="Total" value={view.summary.total} />
        <AdminStatCard label="Completed" value={view.summary.completed} />
        <AdminStatCard label="Failed" value={view.summary.failed} />
        <AdminStatCard label="Expired" value={view.summary.expired} />
      </div>
      <AdminFilterBar>
        <Link href="/app/admin/exports" className="text-xs underline">All</Link>
        <Link href="/app/admin/exports?filter=failed" className="text-xs underline">Failed</Link>
        <Link href="/app/admin/exports?filter=expired" className="text-xs underline">Expired</Link>
        <Link href="/app/admin/exports?filter=recent" className="text-xs underline">Recent 24h</Link>
      </AdminFilterBar>
      <AdminTable>
        <thead className="border-b bg-surface-panel text-xs uppercase text-text-neutral"><tr><th className="px-3 py-2">Export</th><th>Status</th><th>Owner</th><th>Storage</th><th>Created/Expires</th><th>Action</th></tr></thead>
        <tbody>
          {view.rows.map((item) => (
            <tr key={item.export_id} className="border-b border-border-subtle/60 text-xs">
              <td className="px-3 py-2">{item.export_id}<div className="text-text-neutral">analysis: {item.analysis_id}</div></td>
              <td><ExportStatusBadge value={item.status} /></td>
              <td>{item.owner_email ?? item.account_id}</td>
              <td>{item.content_type ?? "-"}<div className="text-text-neutral">{item.file_size_bytes ?? 0} bytes</div></td>
              <td>{item.created_at}<div className="text-text-neutral">{item.expires_at ?? "-"}</div></td>
              <td>
                {item.status === "failed" ? <form method="post" action={`/api/admin/exports/${item.export_id}/retry`}><button type="submit" className="underline">Regenerate</button></form> : null}
                <Link href={`/app/analyses/${item.analysis_id}/overview`} className="underline">Inspect analysis</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </AdminTable>
    </AdminPageShell>
  );
}
