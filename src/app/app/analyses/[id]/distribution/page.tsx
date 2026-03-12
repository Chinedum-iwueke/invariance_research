import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { InterpretationBlock } from "@/components/dashboard/interpretation-block";
import { MetricRow } from "@/components/dashboard/metric-row";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { MockHistogram, MockMultiMetricPanel } from "@/components/charts/chart-mocks";
import { distributionStats } from "@/lib/mock/analysis";

export default function DistributionPage() {
  return (
    <AnalysisPageFrame title="Trade Distribution" description="Statistical structure of trade outcomes beyond aggregate PnL.">
      <MetricRow metrics={distributionStats} cols={4} />
      <div className="grid gap-4 xl:grid-cols-2">
        <WorkspaceCard title="R-Multiple Distribution" subtitle="Outcome dispersion by trade">
          <MockHistogram />
        </WorkspaceCard>
        <WorkspaceCard title="MAE / MFE Scatter" subtitle="Excursion profile">
          <MockMultiMetricPanel />
        </WorkspaceCard>
      </div>
      <WorkspaceCard title="Trade Duration Distribution" subtitle="Holding-period behavior">
        <MockHistogram />
      </WorkspaceCard>
      <InterpretationBlock body="Edge quality is right-tail dependent. A subset of trades contributes disproportionate expectancy, indicating potential sensitivity to execution and regime filters." />
    </AnalysisPageFrame>
  );
}
