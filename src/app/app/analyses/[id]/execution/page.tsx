import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { DiagnosticLockPanel } from "@/components/dashboard/diagnostic-lock-panel";
import { FigureCard } from "@/components/dashboard/figure-card";
import { InterpretationBlock } from "@/components/dashboard/interpretation-block";
import { MetricRow } from "@/components/dashboard/metric-row";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { MockLineChart } from "@/components/charts/chart-mocks";
import { buildDiagnosticLockModel } from "@/lib/app/diagnostic-locks";
import { executionStats } from "@/lib/mock/analysis";
import { accountService } from "@/lib/server/accounts/service";
import { requireServerSession } from "@/lib/server/auth/session";
import { resolveDiagnosticAccess } from "@/lib/server/entitlements/policy";
import { analysisRepository } from "@/lib/server/repositories/analysis-repository";
import { artifactRepository } from "@/lib/server/repositories/artifact-repository";

export default async function ExecutionPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const state = accountService.getAccountState(session.account_id);
  const { id } = await params;
  const analysis = analysisRepository.findById(id);
  const artifact = analysis ? artifactRepository.findById(analysis.artifact_id) : undefined;
  const access = resolveDiagnosticAccess({ account_id: session.account_id, diagnostic: "execution", parsed_artifact: artifact?.parsed_artifact });

  if (!access.allowed && access.reason !== "enabled") {
    const model = buildDiagnosticLockModel({
      state: access.reason,
      diagnosticTitle: "Execution Sensitivity",
      diagnosticPurpose: "Evaluate edge resilience under worsened spread, slippage, and fee assumptions.",
      currentPlan: state?.account.plan_id,
      requiredPlan: "Professional",
    });
    return (
      <AnalysisPageFrame title="Execution Sensitivity" description="Edge resilience under worsened spread, slippage, and fee assumptions.">
        <DiagnosticLockPanel model={model} />
      </AnalysisPageFrame>
    );
  }

  return (
    <AnalysisPageFrame title="Execution Sensitivity" description="Edge resilience under worsened spread, slippage, and fee assumptions.">
      <WorkspaceCard title="Stress Controls" subtitle="Display-only shell controls">
        <div className="grid gap-2 md:grid-cols-3">
          <label className="text-sm">Spread Multiplier <input type="range" className="mt-2 w-full" /></label>
          <label className="text-sm">Slippage % <input type="range" className="mt-2 w-full" /></label>
          <label className="text-sm">Fee Increase <input type="range" className="mt-2 w-full" /></label>
        </div>
      </WorkspaceCard>
      <FigureCard title="Scenario Performance" subtitle="Net outcome sensitivity by friction level" figure={<MockLineChart />} />
      <MetricRow metrics={executionStats} cols={4} />
      <InterpretationBlock
        body="Expected edge degrades quickly with friction escalation. Strategy viability depends on tight execution quality and market conditions aligned with baseline assumptions."
        bullets={[
          "Cost inflation above threshold materially compresses edge.",
          "Execution conditions should be monitored as deployment gate.",
        ]}
      />
    </AnalysisPageFrame>
  );
}
