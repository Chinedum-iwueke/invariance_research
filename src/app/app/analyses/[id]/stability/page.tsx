import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { AnalysisRunState } from "@/components/dashboard/analysis-run-state";
import { DiagnosticFigure } from "@/components/dashboard/diagnostic-figure";
import { DiagnosticLockPanel } from "@/components/dashboard/diagnostic-lock-panel";
import { FigureCard } from "@/components/dashboard/figure-card";
import { InterpretationBlock } from "@/components/dashboard/interpretation-block";
import { MetricRow } from "@/components/dashboard/metric-row";
import { buildDiagnosticLockModel } from "@/lib/app/diagnostic-locks";
import { metricsFromScoreBands, toInterpretationBlockPayload } from "@/lib/app/analysis-ui";
import { accountService } from "@/lib/server/accounts/service";
import { requireServerSession } from "@/lib/server/auth/session";
import { isAdminIdentity } from "@/lib/server/admin/guards";
import { resolveDiagnosticAccess } from "@/lib/server/entitlements/policy";
import { artifactRepository } from "@/lib/server/repositories/artifact-repository";
import { requireOwnedAnalysisView } from "@/lib/server/services/analysis-view-service";

export default async function StabilityPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const state = accountService.getAccountState(session.account_id);
  const isAdmin = isAdminIdentity({ user_id: session.user_id, email: session.email });
  const { id } = await params;
  const { analysis, record } = requireOwnedAnalysisView(id, session.account_id);
  const artifact = artifactRepository.findById(analysis.artifact_id);
  const access = resolveDiagnosticAccess({ account_id: session.account_id, diagnostic: "stability", parsed_artifact: artifact?.parsed_artifact, is_admin: isAdmin });

  if (!access.allowed && access.reason !== "enabled") {
    const model = buildDiagnosticLockModel({
      state: access.reason,
      diagnosticTitle: "Parameter Stability",
      diagnosticPurpose: "Assess fragility across parameter sweeps and perturbation ranges.",
      currentPlan: state?.account.plan_id,
      requiredPlan: "Research Lab",
      artifactRequirementProfile: "parameter_sweep_bundle",
    });
    return (
      <AnalysisPageFrame title="Parameter Stability" description="Fragility diagnostics across parameter ranges and perturbations.">
        <DiagnosticLockPanel model={model} />
      </AnalysisPageFrame>
    );
  }

  if (!record) {
    return (
      <AnalysisPageFrame title="Parameter Stability" description="Fragility diagnostics across parameter ranges and perturbations.">
        <AnalysisRunState analysis={analysis} />
      </AnalysisPageFrame>
    );
  }

  return (
    <AnalysisPageFrame title="Parameter Stability" description="Fragility diagnostics across parameter ranges and perturbations.">
      <MetricRow metrics={metricsFromScoreBands(record.diagnostics.stability.metrics)} cols={3} />
      <FigureCard title={record.diagnostics.stability.figure?.title ?? "Stability Surface"} subtitle={record.diagnostics.stability.figure?.subtitle} figure={<DiagnosticFigure figure={record.diagnostics.stability.figure} />} />
      <InterpretationBlock {...toInterpretationBlockPayload(record.diagnostics.stability.interpretation)} />
      {record.diagnostics.stability.limitations?.length ? (
        <p className="text-sm text-text-neutral">{record.diagnostics.stability.limitations.join(" • ")}</p>
      ) : null}
    </AnalysisPageFrame>
  );
}
