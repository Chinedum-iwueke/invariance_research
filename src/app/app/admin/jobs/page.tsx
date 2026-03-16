import Link from "next/link";
import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { AdminTable } from "@/components/admin/admin-table";
import { JobStatusBadge } from "@/components/admin/status-badges";
import { listAdminJobs } from "@/lib/server/admin/jobs-service";

export default async function AdminJobsPage({ searchParams }: { searchParams: Promise<{ status?: string; type?: "analysis" | "export" }> }) {
  const params = await searchParams;
  const view = listAdminJobs({ status: params.status, type: params.type });

  return (
    <AdminPageShell title="Jobs Dashboard" description="Analysis and export job queue visibility with safe retry controls.">
      <div className="grid gap-3 md:grid-cols-5">
        <AdminStatCard label="Total" value={view.summary.total} />
        <AdminStatCard label="Queued" value={view.summary.queued} />
        <AdminStatCard label="Processing" value={view.summary.processing} />
        <AdminStatCard label="Failed" value={view.summary.failed} />
        <AdminStatCard label="Stale" value={view.summary.stale} />
      </div>
      <AdminFilterBar>
        <Link href="/app/admin/jobs" className="text-xs underline">All</Link>
        <Link href="/app/admin/jobs?status=failed" className="text-xs underline">Failed</Link>
        <Link href="/app/admin/jobs?status=queued" className="text-xs underline">Queued</Link>
        <Link href="/app/admin/jobs?type=analysis" className="text-xs underline">Analysis</Link>
        <Link href="/app/admin/jobs?type=export" className="text-xs underline">Export</Link>
      </AdminFilterBar>
      <AdminTable>
        <thead className="border-b bg-surface-panel text-xs uppercase text-text-neutral">
          <tr><th className="px-3 py-2">Job</th><th>Type</th><th>Status</th><th>Progress</th><th>Retry</th><th>Error</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {view.rows.map((job) => (
            <tr key={`${job.kind}:${job.job_id}`} className="border-b border-border-subtle/60 text-xs">
              <td className="px-3 py-2">{job.job_id}<div className="text-text-neutral">linked: {job.linked_id}</div></td>
              <td>{job.kind}/{job.job_type}</td>
              <td><JobStatusBadge value={job.status} /></td>
              <td>{job.progress_pct ?? 0}% · {job.current_step ?? "-"}</td>
              <td>{job.retry_count}</td>
              <td>{job.error_code ?? "-"}{job.error_summary ? `: ${job.error_summary.slice(0, 80)}` : ""}</td>
              <td>
                {job.status === "failed" ? (
                  <form method="post" action={`/api/admin/jobs/${job.linked_id}/retry`}>
                    <input type="hidden" name="kind" value={job.kind} />
                    <button className="underline" type="submit">Retry</button>
                  </form>
                ) : null}
                {job.kind === "analysis" ? <Link href={`/app/analyses/${job.linked_id}/overview`} className="underline"> Inspect </Link> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </AdminTable>
    </AdminPageShell>
  );
}
