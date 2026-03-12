import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { FigureCard } from "@/components/dashboard/figure-card";
import { InterpretationBlock } from "@/components/dashboard/interpretation-block";
import { MetricRow } from "@/components/dashboard/metric-row";
import { MockHistogram, MockMultiMetricPanel } from "@/components/charts/chart-mocks";
import { distributionStats } from "@/lib/mock/analysis";

export default function DistributionPage() {
  return (
    <AnalysisPageFrame title="Trade Distribution" description="Statistical structure of trade outcomes beyond aggregate PnL.">
      <MetricRow metrics={distributionStats} cols={4} />
      <div className="grid gap-4 xl:grid-cols-2">
        <FigureCard title="R-Multiple Distribution" subtitle="Outcome dispersion by trade" figure={<MockHistogram />} />
        <FigureCard title="MAE / MFE Scatter" subtitle="Excursion profile" figure={<MockMultiMetricPanel />} />
      </div>
      <FigureCard title="Trade Duration Distribution" subtitle="Holding-period behavior" figure={<MockHistogram />} />
      <InterpretationBlock
        body="Edge quality is right-tail dependent. A subset of trades contributes disproportionate expectancy, indicating sensitivity to execution quality and regime context."
        bullets={[
          "Distribution tails drive cumulative expectancy.",
          "Median trade quality is modest relative to top decile.",
        ]}
      />
    </AnalysisPageFrame>
  );
}
