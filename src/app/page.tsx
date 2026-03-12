import type { Metadata } from "next";
import { ChartCard } from "@/components/charts/chart-card";
import { MockHeatmap, MockLineChart } from "@/components/charts/chart-mocks";
import { DashboardMockShell } from "@/components/public/dashboard-mock-shell";
import { PublicShell } from "@/components/public/public-shell";
import { CtaBanner } from "@/components/public/cta-banner";
import { ArticleCard } from "@/components/public/article-card";
import { PageHero } from "@/components/public/page-hero";
import { ProcessTimeline } from "@/components/public/process-timeline";
import { SectionHeader } from "@/components/ui/section-header";
import { Card } from "@/components/ui/card";
import { FeatureGrid } from "@/components/marketing/feature-grid";
import { featuredResearch } from "@/content/site";

export const metadata: Metadata = {
  title: "Invariance Research | Independent Quantitative Strategy Validation",
  description:
    "Execution-aware analysis, robustness testing, and capital risk diagnostics for serious traders and trading academies.",
};

const methodologySteps = [
  { title: "Strategy Formalization", body: "Convert the strategy into a transparent specification with explicit assumptions." },
  { title: "Execution Modeling", body: "Model spread, slippage, and latency to estimate implementation realism." },
  { title: "Robustness Testing", body: "Stress parameters and evaluate cross-window behavior under adversarial conditions." },
  { title: "Capital Risk Diagnostics", body: "Assess drawdown concentration, risk-of-ruin, and volatility clustering." },
  { title: "Reporting", body: "Deliver institutional-style summaries with clear interpretation and action boundaries." },
] as const;

export default function HomePage() {
  return (
    <PublicShell>
      <main>
        <PageHero
          eyebrow="Independent Quantitative Validation Studio"
          title="Independent Quantitative Strategy Validation"
          description="Execution-aware analysis, robustness testing, and capital risk diagnostics for serious traders and trading academies."
          primaryCta={{ label: "View Research Standards", href: "/research-standards" }}
          secondaryCta={{ label: "Validate Your Strategy", href: "/strategy-validation" }}
          tertiaryCta={{ label: "Explore Strategy Robustness Lab", href: "/robustness-lab" }}
          credibilityLine="Institutional-style validation framework designed to eliminate false edge before capital deployment."
          rightSlot={<ChartCard title="Robustness Heatmap" subtitle="Live readiness snapshot" chart={<MockHeatmap />} />}
        />

        <section className="container-shell space-y-6 py-section-sm">
          <SectionHeader title="Most Trading Strategies Fail in Live Markets" description="Naïve backtests commonly omit slippage, spread, latency, parameter fragility, and regime shifts. The resulting mismatch appears only after capital is deployed." />
          <div className="grid gap-6 md:grid-cols-2">
            <ChartCard title="Naïve Backtest" subtitle="Assumption-heavy simulation" chart={<MockLineChart />} footer="Smooth trajectory often reflects under-modeled execution conditions." />
            <ChartCard title="Execution-Aware Test" subtitle="Realistic implementation assumptions" chart={<MockLineChart />} footer="Observed degradation and drawdown clustering become visible under realistic assumptions." />
          </div>
        </section>

        <section className="container-shell space-y-6 py-section-sm">
          <SectionHeader title="Execution-Aware Validation Framework" description="A disciplined pipeline from strategy definition through structured reporting." />
          <ProcessTimeline
            steps={[
              { title: "Strategy Definition", body: "Formal assumptions and expected edge hypothesis." },
              { title: "Execution Modeling", body: "Market impact, spread, latency, and cost realism." },
              { title: "Robustness Testing", body: "Parameter and scenario stress diagnostics." },
              { title: "Regime Sensitivity Analysis", body: "Behavior across volatility and liquidity states." },
              { title: "Capital Risk Diagnostics", body: "Risk concentration and ruin probabilities." },
            ]}
          />
          <Card className="p-card-md text-sm text-text-neutral">Final output: Structured Validation Report with methodology, findings, and risk interpretation.</Card>
        </section>

        <section className="container-shell space-y-6 py-section-sm">
          <SectionHeader title="Strategy Robustness Lab" description="A platform that tests whether trading strategies survive realistic execution and adverse market conditions." />
          <FeatureGrid columns={4} />
          <DashboardMockShell />
        </section>

        <section className="container-shell space-y-6 py-section-sm">
          <SectionHeader title="Independent Strategy Validation" description="For strategies requiring deeper analysis than automated diagnostics, consulting engagements provide analyst-led review and structured deliverables." />
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
        </section>

        <section className="container-shell space-y-6 py-section-sm">
          <SectionHeader title="Validation Methodology" description="Five-step workflow for consistent, execution-aware evaluation." />
          <ProcessTimeline steps={methodologySteps} />
        </section>

        <section className="container-shell space-y-6 py-section-sm">
          <SectionHeader title="Research & Case Studies" description="Method-driven analysis on fragility, execution, and robustness." />
          <div className="grid gap-6 md:grid-cols-3">
            {featuredResearch.map((article) => (
              <ArticleCard key={article.title} {...article} />
            ))}
          </div>
        </section>

        <section className="container-shell py-section-md">
          <CtaBanner
            title="Validate Your Strategy Before Capital Is Deployed"
            description="Most strategies appear profitable until tested under realistic conditions. The validation framework identifies fragility before capital is exposed."
            primary={{ label: "Run Strategy Diagnostics", href: "/robustness-lab" }}
            secondary={{ label: "Request Validation Audit", href: "/contact" }}
          />
        </section>
      </main>
    </PublicShell>
  );
}
