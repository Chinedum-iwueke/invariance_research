import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { InterpretationBlock } from "@/components/dashboard/interpretation-block";
import { LockedFeatureCard } from "@/components/dashboard/locked-feature-card";
import { MetricRow } from "@/components/dashboard/metric-row";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { ruinStats } from "@/lib/mock/analysis";

export default function RuinPage() {
  return (
    <AnalysisPageFrame title="Risk of Ruin" description="Capital survivability and catastrophic drawdown exposure.">
      <WorkspaceCard title="Sizing Inputs" subtitle="Display shell for future calculator">
        <div className="grid gap-2 md:grid-cols-2">
          <label className="grid gap-1 text-sm">Account Size <input className="h-10 rounded-sm border px-3" defaultValue="$250000" /></label>
          <label className="grid gap-1 text-sm">Risk per Trade <input className="h-10 rounded-sm border px-3" defaultValue="0.75%" /></label>
        </div>
      </WorkspaceCard>
      <MetricRow metrics={ruinStats} cols={4} />
      <InterpretationBlock
        body="Current ruin probability is elevated for institutional tolerance. Position sizing or strategy constraints should be revisited before scaling."
        bullets={[
          "Capital survivability is sensitive to position sizing.",
          "Stress outcomes warrant tighter loss controls.",
        ]}
      />
      <LockedFeatureCard title="Professional risk review recommended" body="Have us run full capital survivability diagnostics with scenario stress and policy recommendations." />
    </AnalysisPageFrame>
  );
}
