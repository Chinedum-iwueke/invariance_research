import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { PlanComparisonTable } from "@/components/dashboard/plan-comparison-table";
import { UpgradePanel } from "@/components/dashboard/upgrade-panel";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";

export default function UpgradePage() {
  return (
    <AnalysisPageFrame title="Upgrade" description="Upgrade for analytical depth and workflow capacity, not generic dashboard features.">
      <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
        <WorkspaceCard title="Professional" subtitle="Core paid tier">
          <p className="text-sm text-text-neutral">Execution sensitivity, full report visibility, export, and materially higher monthly capacity.</p>
        </WorkspaceCard>
        <WorkspaceCard title="Research Lab" subtitle="Premium research tier">
          <p className="text-sm text-text-neutral">Regimes, stability, and the highest productized throughput for advanced validation teams.</p>
        </WorkspaceCard>
        <WorkspaceCard title="Advisory / Enterprise" subtitle="Institutional pathway">
          <p className="text-sm text-text-neutral">Custom limits, confidential workflows, and expert-led audit engagements.</p>
        </WorkspaceCard>
      </div>

      <PlanComparisonTable />

      <UpgradePanel
        title="Choose the plan that matches your diagnostic depth"
        explanation="Explorer remains serious and useful. Upgrade when your artifact quality, run cadence, or required diagnostics exceed Explorer boundaries."
        planHint="Advisory is contact-led for institutional needs."
      />
    </AnalysisPageFrame>
  );
}
