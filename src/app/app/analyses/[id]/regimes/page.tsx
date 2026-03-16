import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { DiagnosticLockPanel } from "@/components/dashboard/diagnostic-lock-panel";
import { FigureCard } from "@/components/dashboard/figure-card";
import { InterpretationBlock } from "@/components/dashboard/interpretation-block";
import { MetricRow } from "@/components/dashboard/metric-row";
import { UpgradePanel } from "@/components/dashboard/upgrade-panel";
import { MockMultiMetricPanel } from "@/components/charts/chart-mocks";
import { buildDiagnosticLockModel } from "@/lib/app/diagnostic-locks";
import { regimeStats } from "@/lib/mock/analysis";
import { accountService } from "@/lib/server/accounts/service";
import { requireServerSession } from "@/lib/server/auth/session";
import { resolveDiagnosticAccess } from "@/lib/server/entitlements/policy";
import { analysisRepository } from "@/lib/server/repositories/analysis-repository";
import { artifactRepository } from "@/lib/server/repositories/artifact-repository";

export default async function RegimesPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const state = accountService.getAccountState(session.account_id);
  const { id } = await params;
  const analysis = analysisRepository.findById(id);
  const artifact = analysis ? artifactRepository.findById(analysis.artifact_id) : undefined;
  const access = resolveDiagnosticAccess({
    account_id: session.account_id,
    diagnostic: "regimes",
    parsed_artifact: artifact?.parsed_artifact,
  });

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

  return (
    <AnalysisPageFrame title="Regime Analysis" description="Performance decomposition by volatility and trend structure.">
      <MetricRow metrics={regimeStats} cols={4} />
      <div className="grid gap-4 xl:grid-cols-2">
        <FigureCard title="Performance by Volatility Regime" subtitle="Low/medium/high-vol behavior" figure={<MockMultiMetricPanel />} />
        <FigureCard title="Performance by Trend Strength" subtitle="Trend/chop segmentation" figure={<MockMultiMetricPanel />} />
      </div>
      <InterpretationBlock
        body="Strategy efficacy clusters in high-volatility trend environments and degrades in choppy, low-volatility states. Regime filters are recommended."
        bullets={[
          "Avoid deployment during low-volatility chop states.",
          "Scale exposure only when trend-strength criteria are met.",
        ]}
      />
      <UpgradePanel
        title="Institutional escalation"
        explanation="When regime fragility drives allocation decisions, involve an expert-led audit for deployment controls."
        planHint="Request strategy audit for mandate-level governance."
      />
    </AnalysisPageFrame>
  );
}
