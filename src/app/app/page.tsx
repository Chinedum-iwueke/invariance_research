import Link from "next/link";
import type { Metadata } from "next";
import { AnalysisTable } from "@/components/dashboard/analysis-table";
import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { MetricRow } from "@/components/dashboard/metric-row";
import { UsageMeter } from "@/components/dashboard/usage-meter";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { buttonVariants } from "@/components/ui/button";
import { analysisLibrary } from "@/lib/mock/analysis";
import { accountService } from "@/lib/server/accounts/service";
import { isAdminIdentity } from "@/lib/server/admin/guards";
import { requireServerSession } from "@/lib/server/auth/session";

export const metadata: Metadata = {
  title: "Workspace",
  description: "Authenticated product shell for the Strategy Robustness Lab.",
};

export default async function AppHomePage() {
  const session = await requireServerSession();
  const state = accountService.getAccountState(session.account_id);
  const usage = accountService.getUsage(session.account_id);
  const isAdmin = isAdminIdentity({ user_id: session.user_id, email: session.email });

  return (
    <AnalysisPageFrame
      title="Research Workspace"
      description="Welcome to the Strategy Robustness Lab. Start a new analysis, review artifacts, and monitor usage boundaries clearly."
    >
      <MetricRow
        metrics={[
          { label: "Recent Analyses", value: String(analysisLibrary.length), helper: "Last 14 days" },
          { label: "Completed", value: "12", tone: "positive", helper: "Validated outputs" },
          { label: "Avg Robustness", value: "69", helper: "Across recent studies" },
          { label: "Audit Flags", value: "3", tone: "warning", helper: "Needs analyst review" },
        ]}
      />

      <UsageMeter
        used={usage.analyses_created}
        limit={state?.entitlements.analyses_per_month ?? 3}
        retentionDays={state?.entitlements.history_retention_days ?? 30}
        unlimited={isAdmin}
      />

      <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <WorkspaceCard title="Quick Start" subtitle="Structured flow" note="Upload, inspect eligibility, run, and review diagnostics with explicit gating reasons.">
          <ol className="space-y-2 text-sm text-text-neutral">
            <li>1. Upload backtest and trade artifacts.</li>
            <li>2. Confirm eligibility and plan boundaries.</li>
            <li>3. Review diagnostics and interpretation summaries.</li>
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/app/new-analysis" className={buttonVariants({ size: "sm" })}>New Analysis</Link>
            <Link href="/app/analyses/alpha-trend-v2/overview" className={buttonVariants({ size: "sm", variant: "secondary" })}>Open Recent Analysis</Link>
            <Link href="/methodology" className={buttonVariants({ size: "sm", variant: "tertiary" })}>Methodology</Link>
          </div>
        </WorkspaceCard>

        <WorkspaceCard title="Recent analyses" subtitle="Latest research artifacts">
          <AnalysisTable analyses={analysisLibrary.slice(0, 2)} />
        </WorkspaceCard>
      </div>
    </AnalysisPageFrame>
  );
}
