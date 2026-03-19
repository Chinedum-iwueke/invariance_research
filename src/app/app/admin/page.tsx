import Link from "next/link";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { listAdminJobs } from "@/lib/server/admin/jobs-service";
import { listAdminWebhookReceipts } from "@/lib/server/admin/webhooks-service";
import { listAdminExports } from "@/lib/server/admin/exports-service";
import { listAdminAccounts } from "@/lib/server/admin/accounts-service";

export default function AdminOverviewPage() {
  const jobs = listAdminJobs();
  const webhooks = listAdminWebhookReceipts();
  const exportsView = listAdminExports();
  const accounts = listAdminAccounts();

  return (
    <AdminPageShell title="Admin / Ops Console" description="Internal operations visibility and safe controls.">
      <div className="grid gap-3 md:grid-cols-4">
        <AdminStatCard label="Jobs failed" value={jobs.summary.failed} />
        <AdminStatCard label="Webhook failures" value={webhooks.summary.failed} />
        <AdminStatCard label="Exports failed" value={exportsView.summary.failed} />
        <AdminStatCard label="Accounts" value={accounts.rows.length} />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Link className="rounded-sm border border-border-subtle bg-surface-white p-4 text-sm hover:bg-surface-panel" href="/app/admin/jobs">Jobs dashboard</Link>
        <Link className="rounded-sm border border-border-subtle bg-surface-white p-4 text-sm hover:bg-surface-panel" href="/app/admin/webhooks">Webhook receipts</Link>
        <Link className="rounded-sm border border-border-subtle bg-surface-white p-4 text-sm hover:bg-surface-panel" href="/app/admin/maintenance">Maintenance controls</Link>
      </div>
    </AdminPageShell>
  );
}
