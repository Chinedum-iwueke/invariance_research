import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { PlanAction } from "@/components/dashboard/plan-action";
import { PlanComparisonTable } from "@/components/dashboard/plan-comparison-table";
import { UpgradePanel } from "@/components/dashboard/upgrade-panel";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { accountService } from "@/lib/server/accounts/service";
import { requireServerSession } from "@/lib/server/auth/session";

export default async function UpgradePage() {
  const session = await requireServerSession();
  const state = await accountService.getAccountState(session.account_id);
  const currentPlan = state?.account.plan_id ?? "free";

  return (
    <AnalysisPageFrame title="Upgrade">
      <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-4">
        <WorkspaceCard title="Free" subtitle="$0">
          <p className="text-sm text-text-neutral">Limited trade CSV runs with preview diagnostics, fallback prop evaluation, no exports, and short retention.</p>
          <div className="pt-3">
            <PlanAction currentPlan={currentPlan} targetPlan="free" />
          </div>
        </WorkspaceCard>
        <WorkspaceCard title="Explorer" subtitle="$39/mo">
          <p className="text-sm text-text-neutral">Trade CSV or exchange export validation, optional context ZIPs, full exports, core diagnostics, and exact prop rules per analysis.</p>
          <div className="pt-3">
            <PlanAction currentPlan={currentPlan} targetPlan="explorer" />
          </div>
        </WorkspaceCard>
        <WorkspaceCard title="Pro" subtitle="$99/mo">
          <p className="text-sm text-text-neutral">Higher trade-history validation capacity, saved prop evaluation profiles, more shares, richer report appendices, and Research Desk request eligibility.</p>
          <div className="pt-3">
            <PlanAction currentPlan={currentPlan} targetPlan="pro" />
          </div>
        </WorkspaceCard>
        <WorkspaceCard title="Research Desk" subtitle="From $1,000">
          <p className="text-sm text-text-neutral">Project-based review for true stability, multi-asset attribution, broker realism, reconstruction, exposure analysis, and independent memos.</p>
          <div className="pt-3">
            <PlanAction currentPlan={currentPlan} targetPlan="research_desk" />
          </div>
        </WorkspaceCard>
      </div>

      <PlanComparisonTable currentPlan={currentPlan} />

      <UpgradePanel
        title="Choose the plan that matches your diagnostic depth"
        explanation="Free remains useful for first evaluation. Upgrade when your artifact quality, run cadence, exports, or required diagnostics exceed Free boundaries."
        planHint="Research Desk is contact-led for high-touch validation."
      />
    </AnalysisPageFrame>
  );
}
