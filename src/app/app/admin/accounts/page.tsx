import Link from "next/link";
import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { AdminTable } from "@/components/admin/admin-table";
import { AccountPlanBadge, WebhookStatusBadge } from "@/components/admin/status-badges";
import { listAdminAccounts } from "@/lib/server/admin/accounts-service";

export default async function AdminAccountsPage({ searchParams }: { searchParams: Promise<{ plan?: string; status?: string; highUsage?: string }> }) {
  const params = await searchParams;
  const view = listAdminAccounts({
    plan: params.plan,
    status: params.status,
    highUsage: params.highUsage === "1",
  });

  return (
    <AdminPageShell title="Accounts & Subscriptions" description="Operational overview for account plans, billing status, and entitlement footprint.">
      <AdminFilterBar>
        <Link href="/app/admin/accounts" className="text-xs underline">All</Link>
        <Link href="/app/admin/accounts?plan=professional" className="text-xs underline">Professional</Link>
        <Link href="/app/admin/accounts?status=past_due" className="text-xs underline">Past due</Link>
        <Link href="/app/admin/accounts?highUsage=1" className="text-xs underline">High usage</Link>
      </AdminFilterBar>
      <div className="flex flex-wrap gap-2 text-xs text-text-neutral">
        {Object.entries(view.summaryByPlan).map(([plan, count]) => (
          <span key={plan} className="rounded-sm border border-border-subtle px-2 py-1">{plan}: {count}</span>
        ))}
      </div>
      <AdminTable>
        <thead className="border-b bg-surface-panel text-xs uppercase text-text-neutral"><tr><th className="px-3 py-2">Account</th><th>Owner</th><th>Plan</th><th>Subscription</th><th>Usage</th><th>Entitlements</th><th>Stripe refs</th></tr></thead>
        <tbody>
          {view.rows.map((item) => (
            <tr key={item.account_id} className="border-b border-border-subtle/60 text-xs">
              <td className="px-3 py-2">{item.account_id}<div className="text-text-neutral">created {item.created_at}</div></td>
              <td>{item.owner_email}</td>
              <td><AccountPlanBadge value={item.plan_id} /></td>
              <td><WebhookStatusBadge value={item.subscription_status} /><div className="text-text-neutral">period end: {item.current_period_end ?? "-"} {item.cancel_at_period_end ? "(canceling)" : ""}</div></td>
              <td>{item.usage_this_month.analyses_created} analyses / {item.usage_this_month.report_exports} exports</td>
              <td>{item.entitlement_summary}</td>
              <td>{item.stripe_customer_id ?? "-"}<div>{item.stripe_subscription_id ?? "-"}</div></td>
            </tr>
          ))}
        </tbody>
      </AdminTable>
    </AdminPageShell>
  );
}
