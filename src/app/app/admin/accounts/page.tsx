import Link from "next/link";
import { revalidatePath } from "next/cache";
import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { AdminTable } from "@/components/admin/admin-table";
import { AccountPlanBadge, WebhookStatusBadge } from "@/components/admin/status-badges";
import { writeAdminAuditLog } from "@/lib/server/admin/audit-log";
import { requireAdminSession } from "@/lib/server/admin/guards";
import { accountService } from "@/lib/server/accounts/service";
import { adminSetAccountPassword, listAdminAccounts } from "@/lib/server/admin/accounts-service";
import { PLAN_LABELS, canonicalPlanId } from "@/lib/server/entitlements/plans";
import type { PlanId } from "@/lib/contracts/account";

export default async function AdminAccountsPage({ searchParams }: { searchParams: Promise<{ plan?: string; status?: string; highUsage?: string }> }) {
  const params = await searchParams;
  const view = await listAdminAccounts({
    plan: params.plan,
    status: params.status,
    highUsage: params.highUsage === "1",
  });

  async function setPassword(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!email || !password) {
      return;
    }

    const actor = await requireAdminSession();
    const updated = await adminSetAccountPassword({ email, password });
    await writeAdminAuditLog({
      actor,
      action: "account.password_set",
      resourceType: "user",
      resourceId: updated.user_id,
      metadata: { email: updated.email },
    });
    revalidatePath("/app/admin/accounts");
  }

  async function overridePlan(formData: FormData) {
    "use server";
    const accountId = String(formData.get("account_id") ?? "").trim();
    const planId = String(formData.get("plan_id") ?? "").trim() as PlanId;
    if (!accountId || !planId) return;
    const actor = await requireAdminSession();
    const canonical = canonicalPlanId(planId);
    const account = await accountService.applyAdminPlanOverride({ account_id: accountId, plan_id: canonical });
    await writeAdminAuditLog({
      actor,
      action: "account.plan_override",
      resourceType: "account",
      resourceId: accountId,
      metadata: { plan_id: account.plan_id, requested_plan_id: planId, source: "admin_accounts_table" },
    });
    revalidatePath("/app/admin/accounts");
  }

  return (
    <AdminPageShell title="Accounts & Subscriptions" description="Operational overview for account plans, billing status, entitlement footprint, and credential controls.">
      <AdminFilterBar>
        <Link href="/app/admin/accounts" className="text-xs underline">All</Link>
        <Link href="/app/admin/accounts?plan=explorer" className="text-xs underline">Explorer</Link>
        <Link href="/app/admin/accounts?status=past_due" className="text-xs underline">Past due</Link>
        <Link href="/app/admin/accounts?highUsage=1" className="text-xs underline">High usage</Link>
      </AdminFilterBar>
      <div className="rounded-sm border border-border-subtle bg-surface-panel/40 p-3">
        <p className="text-xs font-semibold text-text-institutional">Manual password assignment</p>
        <p className="mt-1 text-xs text-text-neutral">Use this admin control to assign or reset credentials for existing email-only users.</p>
        <form action={setPassword} className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-xs text-text-neutral">
            Email
            <input name="email" type="email" required className="mt-1 block rounded-sm border border-border-subtle bg-surface-white px-2 py-1 text-xs text-text-graphite" />
          </label>
          <label className="text-xs text-text-neutral">
            New password
            <input name="password" type="password" required minLength={10} className="mt-1 block rounded-sm border border-border-subtle bg-surface-white px-2 py-1 text-xs text-text-graphite" />
          </label>
          <button type="submit" className="rounded-sm border border-border-subtle bg-surface-white px-3 py-1.5 text-xs text-text-graphite hover:bg-surface-panel">Set password</button>
        </form>
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-text-neutral">
        {Object.entries(view.summaryByPlan).map(([plan, count]) => (
          <span key={plan} className="rounded-sm border border-border-subtle px-2 py-1">{plan}: {count}</span>
        ))}
      </div>
      <AdminTable>
        <thead className="border-b bg-surface-panel text-xs uppercase text-text-neutral"><tr><th className="px-3 py-2">Account</th><th>Owner</th><th>Plan</th><th>Override</th><th>Subscription</th><th>Research usage</th><th>Audit usage</th><th>Entitlements</th><th>Password</th><th>Stripe refs</th></tr></thead>
        <tbody>
          {view.rows.map((item) => (
            <tr key={item.account_id} className="border-b border-border-subtle/60 text-xs">
              <td className="px-3 py-2">{item.account_id}<div className="text-text-neutral">created {item.created_at}</div></td>
              <td>{item.owner_email}</td>
              <td><AccountPlanBadge value={item.plan_id} /></td>
              <td>
                <form action={overridePlan} className="flex min-w-[180px] items-center gap-2">
                  <input type="hidden" name="account_id" value={item.account_id} />
                  <select name="plan_id" defaultValue={canonicalPlanId(item.plan_id)} className="rounded-sm border border-border-subtle bg-surface-white px-2 py-1 text-xs text-text-graphite">
                    {Object.entries(PLAN_LABELS).map(([plan, label]) => (
                      <option key={plan} value={plan}>{label}</option>
                    ))}
                  </select>
                  <button type="submit" className="rounded-sm border border-border-subtle bg-surface-white px-2 py-1 text-xs text-text-graphite hover:bg-surface-panel">Apply</button>
                </form>
              </td>
              <td><WebhookStatusBadge value={item.subscription_status} /><div className="text-text-neutral">period end: {item.current_period_end ?? "-"} {item.cancel_at_period_end ? "(canceling)" : ""}</div></td>
              <td className="min-w-[180px] leading-relaxed">
                <div>{item.usage_this_month.programs_created} programs / {item.usage_this_month.hypotheses_created} hypotheses</div>
                <div>{item.usage_this_month.experiments_queued} experiments / {item.usage_this_month.experiment_compute_units} compute units</div>
                <div>{item.usage_this_month.assistant_calls} assistant calls / {item.usage_this_month.research_desk_requests} desk requests</div>
              </td>
              <td className="leading-relaxed">
                <div>{item.usage_this_month.analyses_created} analyses</div>
                <div>{item.usage_this_month.artifacts_uploaded} uploads</div>
                <div>{item.usage_this_month.report_exports} exports / {item.usage_this_month.share_links_created} shares</div>
              </td>
              <td className="max-w-[260px] leading-relaxed">{item.entitlement_summary}</td>
              <td>{item.has_password ? "Configured" : "Email-only"}</td>
              <td>{item.stripe_customer_id ?? "-"}<div>{item.stripe_subscription_id ?? "-"}</div></td>
            </tr>
          ))}
        </tbody>
      </AdminTable>
    </AdminPageShell>
  );
}
