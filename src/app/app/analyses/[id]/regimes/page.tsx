import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { InterpretationBlock } from "@/components/dashboard/interpretation-block";
import { LockedFeatureCard } from "@/components/dashboard/locked-feature-card";
import { MetricRow } from "@/components/dashboard/metric-row";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { MockMultiMetricPanel } from "@/components/charts/chart-mocks";
import { regimeStats } from "@/lib/mock/analysis";

export default function RegimesPage() {
  return (
    <AnalysisPageFrame title="Regime Analysis" description="Performance decomposition by volatility and trend structure.">
      <MetricRow metrics={regimeStats} cols={4} />
      <div className="grid gap-4 xl:grid-cols-2">
        <WorkspaceCard title="Performance by Volatility Regime" subtitle="Low/medium/high-vol behavior">
          <MockMultiMetricPanel />
        </WorkspaceCard>
        <WorkspaceCard title="Performance by Trend Strength" subtitle="Trend/chop segmentation">
          <MockMultiMetricPanel />
        </WorkspaceCard>
      </div>
      <InterpretationBlock body="Strategy efficacy clusters in high-volatility trend environments and degrades in choppy, low-volatility states. Regime filters are recommended." />
      <LockedFeatureCard title="Unlock advanced regime diagnostics" body="Access deeper clustering diagnostics and auto-generated 'when not to trade' constraints." />
    </AnalysisPageFrame>
  );
}
