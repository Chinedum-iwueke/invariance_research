import Link from "next/link";
import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { AdminTable } from "@/components/admin/admin-table";
import { WebhookStatusBadge } from "@/components/admin/status-badges";
import { listAdminWebhookReceipts } from "@/lib/server/admin/webhooks-service";

export default async function AdminWebhooksPage({ searchParams }: { searchParams: Promise<{ filter?: "failed" | "unprocessed" | "recent" }> }) {
  const params = await searchParams;
  const view = listAdminWebhookReceipts(params.filter);

  return (
    <AdminPageShell title="Webhook Receipts" description="Stripe webhook receipt processing and idempotency visibility.">
      <div className="grid gap-3 md:grid-cols-4">
        <AdminStatCard label="Total" value={view.summary.total} />
        <AdminStatCard label="Failed" value={view.summary.failed} />
        <AdminStatCard label="Unprocessed" value={view.summary.unprocessed} />
        <AdminStatCard label="Idempotent no-op" value={view.summary.idempotent_noop} />
      </div>
      <AdminFilterBar>
        <Link href="/app/admin/webhooks" className="text-xs underline">All</Link>
        <Link href="/app/admin/webhooks?filter=failed" className="text-xs underline">Failed</Link>
        <Link href="/app/admin/webhooks?filter=unprocessed" className="text-xs underline">Unprocessed</Link>
        <Link href="/app/admin/webhooks?filter=recent" className="text-xs underline">Recent 24h</Link>
      </AdminFilterBar>
      <AdminTable>
        <thead className="border-b bg-surface-panel text-xs uppercase text-text-neutral"><tr><th className="px-3 py-2">Event</th><th>Status</th><th>Attempts</th><th>Timestamps</th><th>Error</th><th>Action</th></tr></thead>
        <tbody>
          {view.rows.map((item) => (
            <tr key={item.provider_event_id} className="border-b border-border-subtle/60 text-xs">
              <td className="px-3 py-2">{item.provider_event_id}<div className="text-text-neutral">{item.event_type}</div></td>
              <td><WebhookStatusBadge value={item.status} /></td>
              <td>{item.attempt_count}</td>
              <td>{item.received_at}<div className="text-text-neutral">{item.processed_at ?? "-"}</div></td>
              <td>{item.error_summary ?? (item.idempotent_noop ? "idempotent_noop" : "-")}</td>
              <td>{item.status === "failed" ? <form method="post" action={`/api/admin/webhooks/${item.provider_event_id}/reprocess`}><button type="submit" className="underline">Reprocess</button></form> : "-"}</td>
            </tr>
          ))}
        </tbody>
      </AdminTable>
    </AdminPageShell>
  );
}
