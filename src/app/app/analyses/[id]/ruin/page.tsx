import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { DiagnosticLockPanel } from "@/components/dashboard/diagnostic-lock-panel";
import { InterpretationBlock } from "@/components/dashboard/interpretation-block";
import { MetricRow } from "@/components/dashboard/metric-row";
import { UpgradePanel } from "@/components/dashboard/upgrade-panel";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { buildDiagnosticLockModel } from "@/lib/app/diagnostic-locks";
import { ruinStats } from "@/lib/mock/analysis";
import { accountService } from "@/lib/server/accounts/service";
import { requireServerSession } from "@/lib/server/auth/session";
import { resolveDiagnosticAccess } from "@/lib/server/entitlements/policy";
import { analysisRepository } from "@/lib/server/repositories/analysis-repository";
import { artifactRepository } from "@/lib/server/repositories/artifact-repository";

export default async function RuinPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const state = accountService.getAccountState(session.account_id);
  const { id } = await params;
  const analysis = analysisRepository.findById(id);
  const artifact = analysis ? artifactRepository.findById(analysis.artifact_id) : undefined;
  const access = resolveDiagnosticAccess({ account_id: session.account_id, diagnostic: "ruin", parsed_artifact: artifact?.parsed_artifact });

  if (!access.allowed && access.reason !== "enabled") {
    const model = buildDiagnosticLockModel({
      state: access.reason,
      diagnosticTitle: "Risk of Ruin",
      diagnosticPurpose: "Estimate capital survivability and catastrophic drawdown exposure under stress assumptions.",
      currentPlan: state?.account.plan_id,
      requiredPlan: "Professional",
    });
    return (
      <AnalysisPageFrame title="Risk of Ruin" description="Capital survivability and catastrophic drawdown exposure.">
        <DiagnosticLockPanel model={model} />
      </AnalysisPageFrame>
    );
  }

  return (
    <AnalysisPageFrame title="Risk of Ruin" description="Capital survivability and catastrophic drawdown exposure.">
      <WorkspaceCard title="Sizing Inputs" subtitle="Display shell for future calculator">
        <div className="grid gap-2 md:grid-cols-2">
          <label className="grid gap-1 text-sm">Account Size <input className="h-10 rounded-sm border px-3" defaultValue="$250000" /></label>
          <label className="grid gap-1 text-sm">Risk per Trade <input className="h-10 rounded-sm border px-3" defaultValue="0.75%" /></label>
        </div>
      </WorkspaceCard>
      <MetricRow metrics={ruinStats} cols={4} />
      <InterpretationBlock
        body="Current ruin probability is elevated for institutional tolerance. Position sizing or strategy constraints should be revisited before scaling."
        bullets={[
          "Capital survivability is sensitive to position sizing.",
          "Stress outcomes warrant tighter loss controls.",
        ]}
      />
      <UpgradePanel
        title="High ruin profile detected"
        explanation="If this strategy is intended for meaningful capital, request an expert-led survivability review and control policy audit."
        planHint="Advisory pathway for mandate-level governance."
      />
    </AnalysisPageFrame>
  );
}
