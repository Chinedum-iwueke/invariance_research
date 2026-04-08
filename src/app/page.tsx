import type { Metadata } from "next";
import {
  CapabilityCard,
  ComparisonTogglePanel,
  DataVizFeatureCard,
  HeroScene,
  MetricSnapshotStrip,
  NaiveVsExecutionVisual,
  ProcessStepperCarouselCard,
  RegimeHeatmapVisual,
  ScrollspyRail,
  SectionSceneWrapper,
  StrategyBenchmarkVisual,
} from "@/components/public/home-scenes";
import { SectionHeader } from "@/components/ui/section-header";
import { Card } from "@/components/ui/card";
import { PublicShell } from "@/components/public/public-shell";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Invariance Research | Independent Quantitative Strategy Validation",
  description:
    "Execution-aware analysis, robustness testing, and capital risk diagnostics for quantitative traders.",
};

const frameworkSteps = [
  {
    title: "Strategy Definition",
    body: "Formalize trade logic, filters, and hypothesis boundaries before diagnostics begin.",
    note: "Step 1 — Theory integrity",
  },
  {
    title: "Execution Modeling",
    body: "Inject realistic spread, latency, and slippage assumptions to prevent under-modeled edge.",
    note: "Step 2 — Friction modeling",
  },
  {
    title: "Robustness Testing",
    body: "Stress key parameters over window shifts and adversarial slices to identify fragility.",
    note: "Step 3 — Stability pressure",
  },
  {
    title: "Regime Sensitivity Analysis",
    body: "Evaluate strategy behavior through volatility and liquidity regime transitions.",
    note: "Step 4 — Regime mapping",
  },
  {
    title: "Capital Risk Diagnostics",
    body: "Quantify drawdown concentration, ruin likelihood, and capital allocation limits.",
    note: "Step 5 — Deployment controls",
  },
] as const;

const sceneIds = ["hero", "problem", "lab", "consulting"];

export default function HomePage() {
  return (
    <PublicShell>
      <main className="relative bg-surface-panel/55">
        <ScrollspyRail sectionIds={sceneIds} />

        <HeroScene />

        <SectionSceneWrapper id="problem" tone="soft" transition="sheet-reveal">
          <div className="space-y-8">
            <SectionHeader
              title="Most Trading Strategies Fail in Live Markets"
              description="Naïve backtests commonly omit slippage, spread, latency, parameter fragility, and regime shifts. The mismatch appears after capital is deployed."
            />
            <ComparisonTogglePanel
              items={[
                {
                  label: "Naïve Backtest",
                  title: "Assumption-heavy simulations mask implementation risk.",
                  body: "Without execution friction and adverse-condition stress, equity curves appear stable and deceptively deployable.",
                  visual: <NaiveVsExecutionVisual />,
                },
                {
                  label: "Execution-Aware Test",
                  title: "Realistic assumptions surface true risk before deployment.",
                  body: "Applying spread, slippage, and latency assumptions reveals degradation, drawdown clustering, and fragile parameter dependence.",
                  visual: <NaiveVsExecutionVisual executionAware />,
                },
              ]}
            />

            <div className="space-y-4">
              <SectionHeader
                title="Execution-Aware Validation Framework"
                description="A disciplined pipeline from strategy definition through structured institutional reporting."
              />
              <ProcessStepperCarouselCard
                title="Validation Process"
                subtitle="A five-stage validation sequence that translates strategy intent into deployable, risk-aware evidence."
                steps={frameworkSteps}
              />
              <Card className="space-y-4 p-card-md text-sm text-text-neutral">
                <p>Final output: structured validation report with methodology traceability, primary findings, and capital-risk interpretation.</p>
                <Button asChild>
                  <Link href="/research-standards">View Research Standards</Link>
                </Button>
              </Card>
            </div>
          </div>
        </SectionSceneWrapper>

        <SectionSceneWrapper id="lab" tone="base">
          <div className="space-y-8">
            <SectionHeader
              title="Strategy Robustness Lab"
              description="Diagnostics focused on whether a strategy remains credible under realistic execution and adverse market states."
            />
            <div className="grid gap-4 md:grid-cols-4">
              <CapabilityCard title="Validation Methodology" body="A rules-based test protocol with controlled assumptions and transparent acceptance criteria." />
              <CapabilityCard title="Execution Diagnostics" body="Cost and implementation realism across spread, slippage, and latency envelopes." />
              <CapabilityCard title="Capital Risk Analysis" body="Drawdown concentration, ruin sensitivity, and exposure constraints for deployment readiness." />
              <CapabilityCard title="Benchmark Comparison" body="Relative edge analysis against institutional benchmark trajectories and stress baselines." />
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <DataVizFeatureCard title="Strategy Equity vs Benchmark" subtitle="Comparative trajectory diagnostics">
                <StrategyBenchmarkVisual />
              </DataVizFeatureCard>
              <DataVizFeatureCard title="Regime Stress Heatmap" subtitle="Regime-conditioned robustness matrix">
                <RegimeHeatmapVisual />
              </DataVizFeatureCard>
            </div>

            <MetricSnapshotStrip
              metrics={[
                { label: "Live Readiness", value: "74 / 100" },
                { label: "Max Drawdown", value: "-12.8%", tone: "alert" },
                { label: "Sharpe (Adj.)", value: "1.32", tone: "positive" },
                { label: "Stress Pass Rate", value: "82%" },
              ]}
            />
          </div>
        </SectionSceneWrapper>

        <SectionSceneWrapper id="consulting" tone="panel" className="border-b border-border-subtle">
          <div className="space-y-8">
            <SectionHeader
              title="Independent Strategy Validation"
              description="Analyst-led engagements for teams requiring deeper review than automated diagnostics alone."
            />
            <div className="grid gap-4 md:grid-cols-2">
              {[
                "Execution-aware backtest",
                "Monte Carlo robustness testing",
                "Parameter stability analysis",
                "Regime performance diagnostics",
                "Capital risk modeling",
                "Structured validation report",
              ].map((item) => (
                <Card key={item} className="p-card-md text-sm text-text-graphite">
                  {item}
                </Card>
              ))}
            </div>

            <ProcessStepperCarouselCard
              title="Analyst Engagement Workflow"
              subtitle="The same five-step framework is reused in consulting engagements, with deeper manual review and interpretation."
              steps={frameworkSteps}
            />

            <Card className="bg-surface-panel/65 p-8 text-center">
              <h3 className="text-2xl font-semibold text-text-graphite">Validate Your Strategy Before Capital Is Deployed</h3>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-text-neutral">
                Most strategies appear profitable until tested under realistic conditions. The validation framework identifies fragility before capital is exposed.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <Button asChild>
                  <Link href="/robustness-lab">Run Strategy Diagnostics</Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href="/contact">Request Validation Audit</Link>
                </Button>
              </div>
            </Card>
          </div>
        </SectionSceneWrapper>
      </main>
    </PublicShell>
  );
}
