import type { Metadata } from "next";
import Link from "next/link";
import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { UsageMeter } from "@/components/dashboard/usage-meter";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { accountService } from "@/lib/server/accounts/service";
import { isAdminIdentity } from "@/lib/server/admin/guards";
import { requireServerSession } from "@/lib/server/auth/session";

export const metadata: Metadata = {
  title: "Settings",
  description: "Workspace settings and account controls.",
};

export default async function SettingsPage() {
  const session = await requireServerSession();
  const state = accountService.getAccountState(session.account_id);
  const usage = accountService.getUsage(session.account_id);
  const isAdmin = isAdminIdentity({ user_id: session.user_id, email: session.email });

  return (
    <AnalysisPageFrame title="Settings" description="Profile, plan posture, and account governance preferences.">
      <div className="grid gap-4 xl:grid-cols-2">
        <WorkspaceCard title="Profile" subtitle="Identity">
          <p className="text-sm text-text-neutral">Email: {session.email}</p>
          <p className="text-sm text-text-neutral">User ID: {session.user_id}</p>
        </WorkspaceCard>
        <WorkspaceCard title="Plan & Access" subtitle="Current tier">
          <p className="text-sm text-text-neutral">Tier: {state?.account.plan_id ?? "explorer"}</p>
          <p className="text-sm text-text-neutral">Status: {state?.account.subscription_status ?? "trialing"}</p>
          <Link href="/app/upgrade" className="mt-3 inline-block rounded-md border px-3 py-2 text-sm">Review plan comparison</Link>
        </WorkspaceCard>
        <UsageMeter
          used={usage.analyses_created}
          limit={state?.entitlements.analyses_per_month ?? 3}
          retentionDays={state?.entitlements.history_retention_days ?? 30}
          unlimited={isAdmin}
        />
        <WorkspaceCard title="Billing" subtitle="Subscription controls">
          <p className="text-sm text-text-neutral">Manage subscription details and review limits in billing.</p>
          <Link href="/app/billing" className="mt-3 inline-block rounded-md border px-3 py-2 text-sm">Open billing</Link>
        </WorkspaceCard>
      </div>
    </AnalysisPageFrame>
  );
}
