import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { InterpretationBlock } from "@/components/dashboard/interpretation-block";
import { MetricRow } from "@/components/dashboard/metric-row";
import { VerdictCard } from "@/components/dashboard/verdict-card";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { MockLineChart } from "@/components/charts/chart-mocks";
import { overviewDiagnostic, overviewMetrics } from "@/lib/mock/analysis";

export default function OverviewPage() {
  return (
    <AnalysisPageFrame title="Overview" description="High-level trust indicators and validation posture.">
      <MetricRow metrics={overviewMetrics} />

      <WorkspaceCard
        title="Equity and Monte Carlo Posture"
        subtitle="Historical equity vs median and worst simulation paths"
        note="Chart placeholder: Phase 5 will wire backend series payloads."
      >
        <MockLineChart />
      </WorkspaceCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <InterpretationBlock body="The strategy remains viable under baseline assumptions, but stress profiles reveal meaningful tail fragility. Additional controls are advised before scaling." />
        <VerdictCard title={overviewDiagnostic.verdict.title} summary={overviewDiagnostic.verdict.summary} posture={overviewDiagnostic.verdict.posture} />
      </div>

      <WorkspaceCard title="Methodology snippet" subtitle="Validation path used for this artifact">
        <p className="text-sm text-text-neutral">Strategy formalization → execution modeling → robustness stress → regime diagnostics → capital risk synthesis → reporting.</p>
      </WorkspaceCard>
    </AnalysisPageFrame>
  );
}
