import type { Metadata } from "next";
import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";

export const metadata: Metadata = {
  title: "Research Memory",
  description: "Tenant-scoped research memory placeholder.",
};

export default function ResearchMemoryPage() {
  return (
    <AnalysisPageFrame
      title="Research Memory"
      description="Memory will collect thesis history, failures, verdicts, state findings, and next experiments inside each account."
    >
      <WorkspaceCard title="Memory contract" subtitle="B1 stores program events now; later phases add hypothesis, run, verdict, and retrieval memory.">
        <div className="space-y-3 text-sm leading-6 text-text-neutral">
          <p><span className="font-medium text-text-institutional">Tenant scoped:</span> memory is isolated to the account unless an explicit future sharing contract exists.</p>
          <p><span className="font-medium text-text-institutional">Evidence linked:</span> every remembered finding must point back to a program, analysis, run manifest, verdict, or report snapshot.</p>
          <p><span className="font-medium text-text-institutional">No unsupported recall:</span> assistants may retrieve prior failures and decisions, but cannot invent missing market context.</p>
        </div>
      </WorkspaceCard>
    </AnalysisPageFrame>
  );
}
