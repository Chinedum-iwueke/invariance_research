import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { DiagnosticLockPanel } from "@/components/dashboard/diagnostic-lock-panel";
import { FigureCard } from "@/components/dashboard/figure-card";
import { InterpretationBlock } from "@/components/dashboard/interpretation-block";
import { UpgradePanel } from "@/components/dashboard/upgrade-panel";
import { MockHeatmap } from "@/components/charts/chart-mocks";
import { buildDiagnosticLockModel } from "@/lib/app/diagnostic-locks";
import { accountService } from "@/lib/server/accounts/service";
import { requireServerSession } from "@/lib/server/auth/session";
import { resolveDiagnosticAccess } from "@/lib/server/entitlements/policy";
import { analysisRepository } from "@/lib/server/repositories/analysis-repository";
import { artifactRepository } from "@/lib/server/repositories/artifact-repository";

export default async function StabilityPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const state = accountService.getAccountState(session.account_id);
  const { id } = await params;
  const analysis = analysisRepository.findById(id);
  const artifact = analysis ? artifactRepository.findById(analysis.artifact_id) : undefined;
  const access = resolveDiagnosticAccess({ account_id: session.account_id, diagnostic: "stability", parsed_artifact: artifact?.parsed_artifact });

  if (!access.allowed && access.reason !== "enabled") {
    const model = buildDiagnosticLockModel({
      state: access.reason,
      diagnosticTitle: "Parameter Stability",
      diagnosticPurpose: "Assess fragility across parameter surfaces and perturbation ranges.",
      currentPlan: state?.account.plan_id,
      requiredPlan: "Research Lab",
    });
    return (
      <AnalysisPageFrame title="Parameter Stability" description="Fragility diagnostics across parameter ranges and perturbations.">
        <DiagnosticLockPanel model={model} />
      </AnalysisPageFrame>
    );
  }

  return (
    <AnalysisPageFrame title="Parameter Stability" description="Fragility diagnostics across parameter ranges and perturbations.">
      <FigureCard
        title="Stability Surface"
        subtitle="Heatmap of parameter resilience"
        figure={
          <>
            <div className="mb-3 grid gap-2 md:grid-cols-3">
              <select className="h-10 rounded-sm border px-3 text-sm"><option>Lookback Window</option></select>
              <select className="h-10 rounded-sm border px-3 text-sm"><option>Signal Threshold</option></select>
              <select className="h-10 rounded-sm border px-3 text-sm"><option>Risk Budget</option></select>
            </div>
            <MockHeatmap />
          </>
        }
      />
      <InterpretationBlock
        body="Current stability indicates concentration around a narrow parameter island. Broader-range robustness testing is recommended before production deployment."
        bullets={[
          "Narrow optimal band implies fragility risk.",
          "Edge may degrade rapidly outside tuned parameters.",
        ]}
      />
      <UpgradePanel
        title="Severe fragility should trigger expert review"
        explanation="For high-stakes deployment, request a formal fragility and governance review before scaling capital."
        planHint="Advisory pathway for independent validation audit."
      />
    </AnalysisPageFrame>
  );
}
