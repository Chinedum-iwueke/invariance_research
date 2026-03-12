import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { FigureCard } from "@/components/dashboard/figure-card";
import { InterpretationBlock } from "@/components/dashboard/interpretation-block";
import { MetricRow } from "@/components/dashboard/metric-row";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { MockMonteCarloFanChart } from "@/components/charts/chart-mocks";
import { buttonVariants } from "@/components/ui/button";
import { monteCarloStats } from "@/lib/mock/analysis";
import { cn } from "@/lib/utils";

export default function MonteCarloPage() {
  return (
    <AnalysisPageFrame
      title="Monte Carlo Crash Test"
      description="Path-perturbation simulation evaluating drawdown severity and survivability under adverse sequencing."
    >
      <FigureCard
        title="Monte Carlo Equity Fan"
        subtitle="Simulated paths with median and worst-case trajectories"
        figure={<MockMonteCarloFanChart />}
        legend={
          <>
            <span className="inline-flex items-center gap-2"><span className="h-1.5 w-5 rounded-full bg-[#d1d5db]" />Simulation Paths</span>
            <span className="inline-flex items-center gap-2"><span className="h-1.5 w-5 rounded-full bg-chart-benchmark" />Median Path</span>
            <span className="inline-flex items-center gap-2"><span className="h-1.5 w-5 rounded-full bg-brand" />Worst Path</span>
          </>
        }
      />

      <MetricRow metrics={monteCarloStats} cols={6} />

      <InterpretationBlock
        title="Monte Carlo Interpretation"
        body="Tail risk remains significant. While median outcomes remain acceptable, severe path realizations imply meaningful probability of deep impairment without strict risk controls."
        bullets={[
          "Probability of 30% drawdown is high enough to influence deployment policy.",
          "Ruin probability is non-zero and must be sized against capital mandate.",
          "Consider analyst-led stress extension before larger allocation.",
        ]}
      />

      <WorkspaceCard title="Independent review" subtitle="Consulting bridge">
        <p className="text-sm text-text-neutral">Need a deeper independent validation of the stress profile and capital policy implications?</p>
        <a href="/contact" className={cn(buttonVariants({ size: "sm" }), "mt-3 inline-flex")}>
          Request Strategy Audit
        </a>
      </WorkspaceCard>
    </AnalysisPageFrame>
  );
}
