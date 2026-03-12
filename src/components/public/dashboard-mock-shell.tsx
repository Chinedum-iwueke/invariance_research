import { ChartCard } from "@/components/charts/chart-card";
import { MockHeatmap, MockLineChart, MockMultiMetricPanel } from "@/components/charts/chart-mocks";

export function DashboardMockShell() {
  return (
    <div className="grid gap-4">
      <ChartCard title="Strategy Equity vs Benchmark" subtitle="Execution-adjusted" chart={<MockLineChart />} />
      <div className="grid gap-4 md:grid-cols-2">
        <ChartCard title="Regime Stress Heatmap" chart={<MockHeatmap />} />
        <ChartCard title="Risk Snapshot" chart={<MockMultiMetricPanel />} />
      </div>
    </div>
  );
}
