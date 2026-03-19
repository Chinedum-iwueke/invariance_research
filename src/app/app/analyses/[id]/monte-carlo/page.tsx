import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { FigureCard } from "@/components/dashboard/figure-card";
import { InterpretationBlock } from "@/components/dashboard/interpretation-block";
import { MetricRow } from "@/components/dashboard/metric-row";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { MockMonteCarloFanChart } from "@/components/charts/chart-mocks";
import { buttonVariants } from "@/components/ui/button";
import { getAnalysisRecord, monteCarloStats, toInterpretationBlockPayload } from "@/lib/mock/analysis";
import { cn } from "@/lib/utils";

export default function MonteCarloPage() {
  const analysis = getAnalysisRecord("alpha-trend-v2");
  return (
    <AnalysisPageFrame title="Monte Carlo Crash Test" description="Path-perturbation simulation evaluating drawdown severity and survivability under adverse sequencing.">
      <FigureCard
        title="Primary Crash-Test Fan"
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

      <div className="grid gap-5 2xl:grid-cols-[1.25fr_0.95fr]">
        <InterpretationBlock {...toInterpretationBlockPayload(analysis.diagnostics.monte_carlo.interpretation)} />

        <WorkspaceCard title="Independent review" subtitle="Consulting bridge">
          <p className="text-sm text-text-neutral">
            Need a deeper independent validation of the stress profile and capital policy implications?
          </p>
          <a href="/contact" className={cn(buttonVariants({ size: "sm" }), "mt-3 inline-flex")}>
            Request Strategy Audit
          </a>
        </WorkspaceCard>
      </div>
    </AnalysisPageFrame>
  );
}
