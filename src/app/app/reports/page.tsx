import Link from "next/link";
import type { Metadata } from "next";
import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Program Reports",
  description: "Program-level report library.",
};

export default function ProgramReportsPage() {
  return (
    <AnalysisPageFrame
      title="Program Reports"
      description="Program reports will summarize thesis milestones across hypotheses, imports, runs, verdicts, and Research Desk handoffs."
    >
      <WorkspaceCard
        title="Report scope"
        subtitle="Audit-import reports remain available today. Program milestone reports arrive after hypothesis and experiment objects are live."
        toolbar={<Link href="/app/analyses" className={buttonVariants({ size: "sm", variant: "secondary" })}>Open Audit Reports</Link>}
      >
        <div className="grid gap-3 text-sm text-text-neutral md:grid-cols-3">
          <div className="rounded-md border border-border-subtle bg-surface-subtle p-4">
            <p className="font-medium text-text-institutional">Milestone summary</p>
            <p className="mt-2 leading-6">What changed after a sequence of experiments, not just one upload.</p>
          </div>
          <div className="rounded-md border border-border-subtle bg-surface-subtle p-4">
            <p className="font-medium text-text-institutional">Evidence lineage</p>
            <p className="mt-2 leading-6">Every claim in the report must point to a program event, run, or imported analysis.</p>
          </div>
          <div className="rounded-md border border-border-subtle bg-surface-subtle p-4">
            <p className="font-medium text-text-institutional">Decision memo</p>
            <p className="mt-2 leading-6">The output remains a defensible validation memo, now at program level.</p>
          </div>
        </div>
      </WorkspaceCard>
    </AnalysisPageFrame>
  );
}
