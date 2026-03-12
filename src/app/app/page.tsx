import Link from "next/link";
import type { Metadata } from "next";
import { AnalysisTable } from "@/components/dashboard/analysis-table";
import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { MetricRow } from "@/components/dashboard/metric-row";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { buttonVariants } from "@/components/ui/button";
import { analysisLibrary } from "@/lib/mock/analysis";

export const metadata: Metadata = {
  title: "Workspace",
  description: "Authenticated product shell for the Strategy Robustness Lab.",
};

export default function AppHomePage() {
  return (
    <AnalysisPageFrame
      title="Research Workspace"
      description="Welcome to the Strategy Robustness Lab. Start a new analysis, review recent artifacts, and continue your validation workflow."
    >
      <MetricRow
        metrics={[
          { label: "Recent Analyses", value: String(analysisLibrary.length), helper: "Last 14 days" },
          { label: "Completed", value: "12", tone: "positive", helper: "Validated outputs" },
          { label: "Avg Robustness", value: "69", helper: "Across recent studies" },
          { label: "Audit Flags", value: "3", tone: "warning", helper: "Needs analyst review" },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <WorkspaceCard title="Quick Start" subtitle="Structured flow" note="Phase 4 will enable upload parsing and job execution.">
          <ol className="space-y-2 text-sm text-text-neutral">
            <li>1. Upload backtest and trade artifacts.</li>
            <li>2. Confirm assumptions and execution settings.</li>
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
