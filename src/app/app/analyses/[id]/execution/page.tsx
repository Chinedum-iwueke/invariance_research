import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { AnalysisRunState } from "@/components/dashboard/analysis-run-state";
import { DiagnosticFigure } from "@/components/dashboard/diagnostic-figure";
import { DiagnosticLockPanel } from "@/components/dashboard/diagnostic-lock-panel";
import { FigureCard } from "@/components/dashboard/figure-card";
import { InterpretationBlock } from "@/components/dashboard/interpretation-block";
import { MetricRow } from "@/components/dashboard/metric-row";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { buildDiagnosticLockModel } from "@/lib/app/diagnostic-locks";
import { metricsFromScoreBands, toInterpretationBlockPayload } from "@/lib/app/analysis-ui";
import { accountService } from "@/lib/server/accounts/service";
import { requireServerSession } from "@/lib/server/auth/session";
import { isAdminIdentity } from "@/lib/server/admin/guards";
import { resolveDiagnosticAccess } from "@/lib/server/entitlements/policy";
import { artifactRepository } from "@/lib/server/repositories/artifact-repository";
import { requireOwnedAnalysisView } from "@/lib/server/services/analysis-view-service";

export default async function ExecutionPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const state = accountService.getAccountState(session.account_id);
  const isAdmin = isAdminIdentity({ user_id: session.user_id, email: session.email });
  const { id } = await params;
  const { analysis, record } = requireOwnedAnalysisView(id, session.account_id);
  const artifact = artifactRepository.findById(analysis.artifact_id);
  const access = resolveDiagnosticAccess({ account_id: session.account_id, diagnostic: "execution", parsed_artifact: artifact?.parsed_artifact, is_admin: isAdmin });

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

  if (!record) {
    return (
      <AnalysisPageFrame title="Execution Sensitivity" description="Edge resilience under worsened spread, slippage, and fee assumptions.">
        <AnalysisRunState analysis={analysis} />
      </AnalysisPageFrame>
    );
  }

  return (
    <AnalysisPageFrame title="Execution Sensitivity" description="Edge resilience under worsened spread, slippage, and fee assumptions.">
      <FigureCard title={record.diagnostics.execution.figure?.title ?? "Scenario Performance"} subtitle={record.diagnostics.execution.figure?.subtitle} figure={<DiagnosticFigure figure={record.diagnostics.execution.figure} />} note={record.diagnostics.execution.figure?.note} />
      <MetricRow metrics={metricsFromScoreBands(record.diagnostics.execution.metrics)} cols={3} />
      <WorkspaceCard title="Scenario assumptions" subtitle="Persisted execution scenarios">
        {record.diagnostics.execution.scenarios.length === 0 ? (
          <p className="text-sm text-text-neutral">No scenario matrix was emitted by the engine for this run.</p>
        ) : (
          <ul className="space-y-2 text-sm text-text-neutral">
            {record.diagnostics.execution.scenarios.map((scenario) => (
              <li key={`${scenario.name}-${scenario.assumption}`}>• <span className="font-medium text-text-graphite">{scenario.name}:</span> {scenario.assumption} → {scenario.impact}</li>
            ))}
          </ul>
        )}
      </WorkspaceCard>
      <InterpretationBlock {...toInterpretationBlockPayload(record.diagnostics.execution.interpretation)} />
    </AnalysisPageFrame>
  );
}
