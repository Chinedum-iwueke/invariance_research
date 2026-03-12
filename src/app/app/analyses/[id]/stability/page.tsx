import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { FigureCard } from "@/components/dashboard/figure-card";
import { InterpretationBlock } from "@/components/dashboard/interpretation-block";
import { LockedFeatureCard } from "@/components/dashboard/locked-feature-card";
import { MockHeatmap } from "@/components/charts/chart-mocks";

export default function StabilityPage() {
  return (
    <AnalysisPageFrame title="Parameter Stability" description="Fragility diagnostics across parameter ranges and perturbations.">
      <FigureCard
        title="Stability Surface"
        subtitle="Heatmap of parameter resilience"
        figure={
          <>
            <div className="mb-3 grid gap-2 md:grid-cols-3">
              <select className="h-10 rounded-sm border px-3 text-sm"><option>Lookback Window</option></select>
              <select className="h-10 rounded-sm border px-3 text-sm"><option>Signal Threshold</option></select>
              <select className="h-10 rounded-sm border px-3 text-sm"><option>Risk Budget</option></select>
            </div>
            <MockHeatmap />
          </>
        }
      />
      <InterpretationBlock
        body="Current stability indicates concentration around a narrow parameter island. Broader-range robustness testing is recommended before production deployment."
        bullets={[
          "Narrow optimal band implies fragility risk.",
          "Edge may degrade rapidly outside tuned parameters.",
        ]}
      />
      <LockedFeatureCard title="Advanced fragility diagnostics" body="Unlock full stability surface exports, fragility score decomposition, and parameter drift alerts." />
    </AnalysisPageFrame>
  );
}
