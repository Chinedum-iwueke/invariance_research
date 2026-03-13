import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { FigureCard } from "@/components/dashboard/figure-card";
import { InterpretationBlock } from "@/components/dashboard/interpretation-block";
import { MetricRow } from "@/components/dashboard/metric-row";
import { VerdictCard } from "@/components/dashboard/verdict-card";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { MockEquityComparisonChart } from "@/components/charts/chart-mocks";
import { overviewDiagnostic, overviewMetrics, toInterpretationBlockPayload } from "@/lib/mock/analysis";

export default function OverviewPage() {
  return (
    <AnalysisPageFrame title="Overview" description="Immediate robustness and risk posture for this strategy under execution-aware validation.">
      <MetricRow metrics={overviewMetrics} />

      <FigureCard
        title="Equity Comparison Panel"
        subtitle="Historical equity, median Monte Carlo path, and worst simulated path"
        figure={<MockEquityComparisonChart />}
        legend={
          <>
            <span className="inline-flex items-center gap-2"><span className="h-1.5 w-5 rounded-full bg-[#9ca3af]" />Historical Equity</span>
            <span className="inline-flex items-center gap-2"><span className="h-1.5 w-5 rounded-full bg-chart-benchmark" />Median Monte Carlo</span>
            <span className="inline-flex items-center gap-2"><span className="h-1.5 w-5 rounded-full bg-brand" />Worst Simulated Path</span>
          </>
        }
        note="Figure shell is chart-ready and will receive backend series payloads in Phase 5."
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <InterpretationBlock {...toInterpretationBlockPayload(overviewDiagnostic.interpretation)} />
        <VerdictCard
          title={overviewDiagnostic.verdict.title}
          summary={overviewDiagnostic.verdict.summary}
          posture={overviewDiagnostic.verdict.status}
        />
      </div>

      <WorkspaceCard title="Methodology posture" subtitle="Validation sequence applied to this artifact">
        <p className="text-sm leading-relaxed text-text-neutral">
          Strategy formalization → execution modeling → robustness stress → regime diagnostics → capital-risk synthesis → validation reporting.
        </p>
      </WorkspaceCard>
    </AnalysisPageFrame>
  );
}
