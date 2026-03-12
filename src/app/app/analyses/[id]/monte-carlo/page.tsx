import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { InterpretationBlock } from "@/components/dashboard/interpretation-block";
import { MetricRow } from "@/components/dashboard/metric-row";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { MockLineChart } from "@/components/charts/chart-mocks";
import { monteCarloStats } from "@/lib/mock/analysis";

export default function MonteCarloPage() {
  return (
    <AnalysisPageFrame title="Monte Carlo Crash Test" description="Scenario fan projection of equity outcomes under path perturbation.">
      <WorkspaceCard title="Monte Carlo Equity Fan" subtitle="Simulated paths, median trajectory, and worst path">
        <MockLineChart />
      </WorkspaceCard>
      <MetricRow metrics={monteCarloStats} cols={6} />
      <InterpretationBlock body="Tail outcomes remain material. The probability of severe drawdown is non-trivial under adverse sequencing, reinforcing the need for stricter risk budgeting and execution discipline." />
    </AnalysisPageFrame>
  );
}
