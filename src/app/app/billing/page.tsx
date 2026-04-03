import Link from "next/link";
import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { BillingSummaryCard } from "@/components/dashboard/billing-summary-card";
import { PlanComparisonTable } from "@/components/dashboard/plan-comparison-table";
import { UpgradePanel } from "@/components/dashboard/upgrade-panel";
import { UsageMeter } from "@/components/dashboard/usage-meter";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { buttonVariants } from "@/components/ui/button";
import { accountService } from "@/lib/server/accounts/service";
import { isAdminIdentity } from "@/lib/server/admin/guards";
import { requireServerSession } from "@/lib/server/auth/session";

export default async function BillingPage() {
  const session = await requireServerSession();
  const state = accountService.getAccountState(session.account_id);
  const usage = accountService.getUsage(session.account_id);
  const isAdmin = isAdminIdentity({ user_id: session.user_id, email: session.email });
  const limit = state?.entitlements.analyses_per_month ?? 3;
  const retentionDays = state?.entitlements.history_retention_days ?? 30;
  const remaining = isAdmin ? "Unlimited" : String(Math.max(0, limit - usage.analyses_created));

  return (
    <AnalysisPageFrame title="Billing & Plan" description="Transparent usage, clear plan boundaries, and calm upgrade controls.">
      <BillingSummaryCard
        plan={state?.account.plan_id ?? "explorer"}
        status={state?.account.subscription_status ?? "trialing"}
        analysesUsed={usage.analyses_created}
        analysesLimit={limit}
        retentionDays={retentionDays}
        unlimitedAnalyses={isAdmin}
      />

      <div className="grid gap-4 2xl:grid-cols-2">
        <UsageMeter used={usage.analyses_created} limit={limit} retentionDays={retentionDays} unlimited={isAdmin} />
        <WorkspaceCard title="Usage context" subtitle="Why upgrades are suggested">
          <p className="text-sm text-text-neutral">Analyses remaining this month: {remaining}</p>
          <p className="mt-2 text-sm text-text-neutral">Uploads this month: {usage.artifacts_uploaded}</p>
          <p className="mt-2 text-sm text-text-neutral">Report exports this month: {usage.report_exports}</p>
          <p className="mt-3 text-xs text-text-neutral">Upgrade prompts appear only when diagnostic depth or monthly workflow limits require it.</p>
        </WorkspaceCard>
      </div>

      <WorkspaceCard title="Subscription controls" subtitle="Self-service where available">
        <div className="flex flex-wrap gap-2">
          <Link className={buttonVariants({ size: "sm" })} href="/app/upgrade">Upgrade options</Link>
          <form action="/api/billing/portal" method="post">
            <button className={buttonVariants({ size: "sm", variant: "secondary" })} type="submit">Manage subscription</button>
          </form>
          <Link href="/contact" className={buttonVariants({ size: "sm", variant: "secondary" })}>Request advisory consultation</Link>
        </div>
      </WorkspaceCard>

      <PlanComparisonTable />

      <UpgradePanel
        title="Need deeper diagnostics or more monthly capacity?"
        explanation="Upgrade decisions should follow analytical need: richer artifacts, more runs, and deeper report sections."
        planHint="Professional and Research Lab expand diagnostic depth and workflow capacity."
      />
    </AnalysisPageFrame>
  );
}
