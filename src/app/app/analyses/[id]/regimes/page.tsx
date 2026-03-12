import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { FigureCard } from "@/components/dashboard/figure-card";
import { InterpretationBlock } from "@/components/dashboard/interpretation-block";
import { LockedFeatureCard } from "@/components/dashboard/locked-feature-card";
import { MetricRow } from "@/components/dashboard/metric-row";
import { MockMultiMetricPanel } from "@/components/charts/chart-mocks";
import { regimeStats } from "@/lib/mock/analysis";

export default function RegimesPage() {
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
      <LockedFeatureCard title="Unlock advanced regime diagnostics" body="Access deeper clustering diagnostics and auto-generated 'when not to trade' constraints." />
    </AnalysisPageFrame>
  );
}
