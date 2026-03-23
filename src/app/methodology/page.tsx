import type { Metadata } from "next";
import { ChartCard } from "@/components/charts/chart-card";
import { MockHistogram } from "@/components/charts/chart-mocks";
import { PublicShell } from "@/components/public/public-shell";
import { CtaBanner } from "@/components/public/cta-banner";
import { PageHero } from "@/components/public/page-hero";
import { ProcessTimeline } from "@/components/public/process-timeline";
import { SectionHeader } from "@/components/ui/section-header";

export const metadata: Metadata = {
  title: "Methodology | Invariance Research",
  description: "Five-step execution-aware validation methodology for strategy robustness and capital risk diagnostics.",
};

const steps = [
  {
    title: "Strategy Formalization",
    body: "Define logic, trade constraints, assumptions, and expected edge boundaries in explicit terms.",
  },
  {
    title: "Execution Modeling",
    body: "Simulate implementation friction: spread, slippage, latency, and order-size impact assumptions.",
  },
  {
    title: "Robustness Testing",
    body: "Evaluate parameter stability, perturbation resilience, and out-of-sample behavior.",
  },
  {
    title: "Capital Risk Diagnostics",
    body: "Map tail risk, drawdown concentration, volatility clustering, and risk-of-ruin profiles.",
  },
  {
    title: "Reporting",
    body: "Produce structured findings with limitations, confidence level, and practical decision guidance.",
  },
] as const;

export default function MethodologyPage() {
  return (
    <PublicShell>
      <main>
        <PageHero
          eyebrow="Method"
          title="Validation Methodology"
          description="A five-step framework designed for repeatable, execution-aware strategy evaluation."
          primaryCta={{ label: "Apply via Robustness Lab", href: "/robustness-lab" }}
          secondaryCta={{ label: "Request Full Audit", href: "/contact" }}
        />

        <section className="container-shell space-y-6 py-section-sm">
          <SectionHeader title="Workflow" description="Sequential process emphasizing realism, stress testing, and institutional reporting discipline." />
          <ProcessTimeline steps={steps} />
        </section>



        <section className="container-shell space-y-6 py-section-sm">
          <SectionHeader
            title="Parameter Stability upload contract"
            description="Parameter Stability unlocks only when intake receives a parameter sweep artifact with explicit run-to-parameter mapping."
          />
          <div className="rounded-md border bg-surface-panel p-card-md text-sm text-text-neutral">
            <p className="font-medium text-text-institutional">Required for baseline Parameter Stability</p>
            <ul className="mt-3 space-y-2">
              <li>• Multiple strategy runs spanning parameter combinations.</li>
              <li>• Parameter metadata that maps each <code>run_id</code> to parameter values.</li>
              <li>• Trade history/results for each run in one structured upload bundle.</li>
            </ul>
            <p className="mt-4 font-medium text-text-institutional">Supported formats</p>
            <ul className="mt-3 space-y-2">
              <li>• Preferred: ZIP bundle with <code>manifest.json</code> + per-run trade files + run parameter mapping file.</li>
              <li>• Advanced: one combined table with <code>run_id</code>, parameter columns, and trade/result rows.</li>
              <li>• OHLCV/regime context is optional for baseline stability and reserved for richer future variants.</li>
            </ul>
          </div>
        </section>

        <section className="container-shell space-y-6 py-section-sm">
          <SectionHeader title="Why execution-aware testing matters" description="Backtests without implementation constraints overstate practical edge and understate deployment risk." />
          <ChartCard
            title="Expected Return Distribution Shift"
            subtitle="The shape of outcomes changes under realistic execution assumptions"
            chart={<MockHistogram />}
            footer="Methodology emphasis: distribution-aware diagnostics, not single-metric storytelling."
          />
        </section>

        <section className="container-shell py-section-md">
          <CtaBanner
            title="Use the methodology in your validation workflow"
            description="Run diagnostics through the lab or commission an analyst-led review."
            primary={{ label: "Explore Robustness Lab", href: "/robustness-lab" }}
            secondary={{ label: "Request Strategy Audit", href: "/contact" }}
          />
        </section>
      </main>
    </PublicShell>
  );
}
