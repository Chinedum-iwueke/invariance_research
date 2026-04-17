import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { PlanAction } from "@/components/dashboard/plan-action";
import { PlanComparisonTable } from "@/components/dashboard/plan-comparison-table";
import { UpgradePanel } from "@/components/dashboard/upgrade-panel";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { accountService } from "@/lib/server/accounts/service";
import { requireServerSession } from "@/lib/server/auth/session";

export default async function UpgradePage() {
  const session = await requireServerSession();
  const state = accountService.getAccountState(session.account_id);
  const currentPlan = state?.account.plan_id ?? "explorer";

  return (
    <AnalysisPageFrame title="Upgrade">
      <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-4">
        <WorkspaceCard title="Explorer" subtitle="Foundational tier">
          <p className="text-sm text-text-neutral">Serious baseline diagnostics for lower-frequency validation and disciplined initial workflow cadence.</p>
          <div className="pt-3">
            <PlanAction currentPlan={currentPlan} targetPlan="explorer" />
          </div>
        </WorkspaceCard>
        <WorkspaceCard title="Professional" subtitle="Core paid tier">
          <p className="text-sm text-text-neutral">Execution sensitivity, full report visibility, export, and materially higher monthly capacity.</p>
          <div className="pt-3">
            <PlanAction currentPlan={currentPlan} targetPlan="professional" />
          </div>
        </WorkspaceCard>
        <WorkspaceCard title="Research Lab" subtitle="Premium research tier">
          <p className="text-sm text-text-neutral">Regimes, stability, and the highest productized throughput for advanced validation teams.</p>
          <div className="pt-3">
            <PlanAction currentPlan={currentPlan} targetPlan="research_lab" />
          </div>
        </WorkspaceCard>
        <WorkspaceCard title="Advisory / Enterprise" subtitle="Institutional pathway">
          <p className="text-sm text-text-neutral">Custom limits, confidential workflows, and expert-led audit engagements.</p>
          <div className="pt-3">
            <PlanAction currentPlan={currentPlan} targetPlan="advisory" />
          </div>
        </WorkspaceCard>
      </div>

      <PlanComparisonTable currentPlan={currentPlan} />

      <UpgradePanel
        title="Choose the plan that matches your diagnostic depth"
        explanation="Explorer remains serious and useful. Upgrade when your artifact quality, run cadence, or required diagnostics exceed Explorer boundaries."
        planHint="Advisory is contact-led for institutional needs."
      />
    </AnalysisPageFrame>
  );
}
