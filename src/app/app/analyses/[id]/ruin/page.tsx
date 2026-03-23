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

export default async function RuinPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const state = accountService.getAccountState(session.account_id);
  const isAdmin = isAdminIdentity({ user_id: session.user_id, email: session.email });
  const { id } = await params;
  const { analysis, record } = requireOwnedAnalysisView(id, session.account_id);
  const artifact = artifactRepository.findById(analysis.artifact_id);
  const access = resolveDiagnosticAccess({ account_id: session.account_id, diagnostic: "ruin", parsed_artifact: artifact?.parsed_artifact, is_admin: isAdmin });

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

  if (!record) {
    return (
      <AnalysisPageFrame title="Risk of Ruin" description="Capital survivability and catastrophic drawdown exposure.">
        <AnalysisRunState analysis={analysis} />
      </AnalysisPageFrame>
    );
  }

  return (
    <AnalysisPageFrame title="Risk of Ruin" description="Capital survivability and catastrophic drawdown exposure.">
      <MetricRow metrics={metricsFromScoreBands(record.diagnostics.ruin.metrics)} cols={4} />
      <FigureCard title={record.diagnostics.ruin.figure?.title ?? "Capital Stress Profile"} subtitle={record.diagnostics.ruin.figure?.subtitle} figure={<DiagnosticFigure figure={record.diagnostics.ruin.figure} />} note={record.diagnostics.ruin.figure?.note} />
      <WorkspaceCard title="Ruin assumptions" subtitle="Persisted assumptions from this run">
        {record.diagnostics.ruin.assumptions.length === 0 ? (
          <p className="text-sm text-text-neutral">No explicit ruin assumptions were emitted; rely on metric values and run context notes.</p>
        ) : (
          <ul className="space-y-2 text-sm text-text-neutral">
            {record.diagnostics.ruin.assumptions.map((assumption) => (
              <li key={`${assumption.name}-${assumption.value}`}>• {assumption.name}: {assumption.value}</li>
            ))}
          </ul>
        )}
      </WorkspaceCard>
      <WorkspaceCard title="Survivability guidance" subtitle="Engine-native limitations and recommendations">
        <div className="grid gap-4 text-sm text-text-neutral md:grid-cols-2">
          <ul className="space-y-1">
            {(record.engine_payload.diagnostics.ruin?.limitations ?? []).map((item) => <li key={item}>• {item}</li>)}
          </ul>
          <ul className="space-y-1">
            {(record.engine_payload.diagnostics.ruin?.recommendations ?? []).map((item) => <li key={item}>• {item}</li>)}
          </ul>
        </div>
      </WorkspaceCard>
      <InterpretationBlock {...toInterpretationBlockPayload(record.diagnostics.ruin.interpretation)} />
    </AnalysisPageFrame>
  );
}
