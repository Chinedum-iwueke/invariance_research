import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AnalysisTable } from "@/components/dashboard/analysis-table";
import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { EmptyState } from "@/components/dashboard/empty-state";
import { MetricRow } from "@/components/dashboard/metric-row";
import { UsageMeter } from "@/components/dashboard/usage-meter";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { buttonVariants } from "@/components/ui/button";
import { accountService } from "@/lib/server/accounts/service";
import { isAdminIdentity } from "@/lib/server/admin/guards";
import { requireServerSession } from "@/lib/server/auth/session";
import { listAnalyses } from "@/lib/server/services/analysis-service";

export const metadata: Metadata = {
  title: "Workspace",
  description: "Authenticated product shell for the Strategy Robustness Lab.",
};

export default async function AppHomePage() {
  const session = await requireServerSession();
  const state = accountService.getAccountState(session.account_id);
  const usage = accountService.getUsage(session.account_id);
  const isAdmin = isAdminIdentity({ user_id: session.user_id, email: session.email });
  const analyses = listAnalyses(session.account_id);

  if (analyses.length === 0) {
    redirect("/app/new-analysis");
  }

  const completed = analyses.filter((item) => item.status === "completed").length;
  const processing = analyses.filter((item) => item.status === "processing" || item.status === "queued").length;
  const failed = analyses.filter((item) => item.status === "failed").length;
  const latestCompleted = analyses.find((item) => item.status === "completed");

  return (
    <AnalysisPageFrame
      title="Research Workspace"
      description="Welcome to the Strategy Robustness Lab. Start a new analysis, review artifacts, and monitor usage boundaries clearly."
    >
      <MetricRow
        metrics={[
          { label: "Total Analyses", value: String(analyses.length), helper: "Owned by this account" },
          { label: "Completed", value: String(completed), tone: completed > 0 ? "positive" : "neutral", helper: "Persisted results" },
          { label: "In Progress", value: String(processing), helper: "Queued + processing" },
          { label: "Failed", value: String(failed), tone: failed > 0 ? "warning" : "neutral", helper: "Require retry or fix" },
        ]}
      />

      <UsageMeter
        used={usage.analyses_created}
        limit={state?.entitlements.analyses_per_month ?? 3}
        retentionDays={state?.entitlements.history_retention_days ?? 30}
        unlimited={isAdmin}
      />

      <div className="grid gap-4 2xl:grid-cols-[1.15fr_0.85fr]">
        <WorkspaceCard title="Quick Start" subtitle="Structured flow" note="Upload, inspect eligibility, run, and review diagnostics with explicit gating reasons.">
          <ol className="space-y-2 text-sm text-text-neutral">
            <li>1. Upload backtest and trade artifacts.</li>
            <li>2. Confirm eligibility and plan boundaries.</li>
            <li>3. Review diagnostics and interpretation summaries.</li>
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/app/new-analysis" className={buttonVariants({ size: "sm" })}>New Analysis</Link>
            {latestCompleted ? (
              <Link href={`/app/analyses/${latestCompleted.analysis_id}/overview`} className={buttonVariants({ size: "sm", variant: "secondary" })}>Open Latest Completed</Link>
            ) : (
              <span className={buttonVariants({ size: "sm", variant: "secondary" })}>No completed analyses yet</span>
            )}
            <Link href="/methodology" className={buttonVariants({ size: "sm", variant: "tertiary" })}>Methodology</Link>
          </div>
        </WorkspaceCard>

        <WorkspaceCard title="Recent analyses" subtitle="Latest research artifacts">
          {analyses.length === 0 ? (
            <EmptyState
              title="No analyses yet"
              body="Upload your first artifact to begin. Completed analyses will appear here."
              cta={{ label: "Create New Analysis", href: "/app/new-analysis" }}
            />
          ) : (
            <AnalysisTable analyses={analyses.slice(0, 5)} />
          )}
        </WorkspaceCard>
      </div>
    </AnalysisPageFrame>
  );
}
