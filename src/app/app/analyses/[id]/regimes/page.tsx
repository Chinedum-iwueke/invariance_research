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

export default async function RegimesPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const state = accountService.getAccountState(session.account_id);
  const isAdmin = isAdminIdentity({ user_id: session.user_id, email: session.email });
  const { id } = await params;
  const { analysis, record } = requireOwnedAnalysisView(id, session.account_id);
  const artifact = artifactRepository.findById(analysis.artifact_id);
  const access = resolveDiagnosticAccess({ account_id: session.account_id, diagnostic: "regimes", parsed_artifact: artifact?.parsed_artifact, is_admin: isAdmin });

  if (!access.allowed && access.reason !== "enabled") {
    const model = buildDiagnosticLockModel({
      state: access.reason,
      diagnosticTitle: "Regime Analysis",
      diagnosticPurpose: "Decompose performance by volatility and trend structure to identify deployment conditions.",
      currentPlan: state?.account.plan_id,
      requiredPlan: "Research Lab",
    });
    return (
      <AnalysisPageFrame title="Regime Analysis" description="Performance decomposition by volatility and trend structure.">
        <DiagnosticLockPanel model={model} />
      </AnalysisPageFrame>
    );
  }

  if (!record) {
    return (
      <AnalysisPageFrame title="Regime Analysis" description="Performance decomposition by volatility and trend structure.">
        <AnalysisRunState analysis={analysis} />
      </AnalysisPageFrame>
    );
  }

  return (
    <AnalysisPageFrame title="Regime Analysis" description="Performance decomposition by volatility and trend structure.">
      <MetricRow metrics={metricsFromScoreBands(record.diagnostics.regimes.metrics)} cols={4} />
      <div className="grid gap-4 xl:grid-cols-2">
        {(record.diagnostics.regimes.figures ?? []).map((figure) => (
          <FigureCard key={figure.figure_id} title={figure.title} subtitle={figure.subtitle} figure={<DiagnosticFigure figure={figure} />} note={figure.note} />
        ))}
      </div>
      <InterpretationBlock {...toInterpretationBlockPayload(record.diagnostics.regimes.interpretation)} />
    </AnalysisPageFrame>
  );
}
