import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { FigureCard } from "@/components/dashboard/figure-card";
import { InterpretationBlock } from "@/components/dashboard/interpretation-block";
import { MetricRow } from "@/components/dashboard/metric-row";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { MockLineChart } from "@/components/charts/chart-mocks";
import { executionStats } from "@/lib/mock/analysis";

export default function ExecutionPage() {
  return (
    <AnalysisPageFrame title="Execution Sensitivity" description="Edge resilience under worsened spread, slippage, and fee assumptions.">
      <WorkspaceCard title="Stress Controls" subtitle="Display-only shell controls">
        <div className="grid gap-2 md:grid-cols-3">
          <label className="text-sm">Spread Multiplier <input type="range" className="mt-2 w-full" /></label>
          <label className="text-sm">Slippage % <input type="range" className="mt-2 w-full" /></label>
          <label className="text-sm">Fee Increase <input type="range" className="mt-2 w-full" /></label>
        </div>
      </WorkspaceCard>
      <FigureCard title="Scenario Performance" subtitle="Net outcome sensitivity by friction level" figure={<MockLineChart />} />
      <MetricRow metrics={executionStats} cols={4} />
      <InterpretationBlock
        body="Expected edge degrades quickly with friction escalation. Strategy viability depends on tight execution quality and market conditions aligned with baseline assumptions."
        bullets={[
          "Cost inflation above threshold materially compresses edge.",
          "Execution conditions should be monitored as deployment gate.",
        ]}
      />
    </AnalysisPageFrame>
  );
}
