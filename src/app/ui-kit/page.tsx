import { ChartCard } from "@/components/charts/chart-card";
import { MockHeatmap, MockHistogram, MockLineChart, MockMultiMetricPanel } from "@/components/charts/chart-mocks";
import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { InsightPanel } from "@/components/ui/insight-panel";
import { MetricCard } from "@/components/ui/metric-card";
import { PricingCards } from "@/components/ui/pricing-cards";
import { ReportPreviewCard } from "@/components/ui/report-preview-card";
import { SectionHeader } from "@/components/ui/section-header";
import { UploadPanel } from "@/components/ui/upload-panel";

const colorSwatches = [
  ["Research Red", "#B00020"],
  ["Institutional Black", "#111111"],
  ["Deep Graphite", "#2C2C2C"],
  ["Neutral Gray", "#6B6B6B"],
  ["Panel Gray", "#F7F7F7"],
  ["Divider Gray", "#E5E5E5"],
];

export default function UIKitPage() {
  return (
    <main>
      <Navbar links={[{ label: "Overview", href: "#overview" }, { label: "Components", href: "#components" }, { label: "Charts", href: "#charts" }]} sticky={false} />
      <section id="overview" className="container-shell space-y-8 py-section-md">
        <SectionHeader eyebrow="Design Language" title="Invariance Research UI Kit" description="Institutional-first tokens and reusable building blocks for product and marketing assembly." />
        <div className="grid gap-4 md:grid-cols-3">
          {colorSwatches.map(([name, value]) => (
            <div key={name} className="rounded-sm border p-4">
              <div className="h-16 rounded-sm border" style={{ backgroundColor: value }} />
              <p className="mt-3 text-sm font-medium">{name}</p>
              <p className="text-xs text-text-neutral">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container-shell space-y-6 py-section-sm">
        <SectionHeader title="Typography & Spacing" description="Montserrat-only hierarchy with disciplined 4px/8px rhythm." />
        <div className="space-y-4 rounded-md border p-6">
          <p className="text-[3rem] font-semibold leading-none">Display / 48</p>
          <p className="text-4xl font-semibold">H1 / 36</p>
          <p className="text-3xl font-semibold">H2 / 30</p>
          <p className="text-xl">Body LG / 18</p>
          <p className="text-base">Body / 16</p>
          <p className="text-sm text-text-neutral">Body SM / 14</p>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-neutral">Label / 12 uppercase</p>
        </div>
      </section>

      <section id="components" className="container-shell space-y-8 py-section-sm">
        <SectionHeader title="Buttons, Alerts, and Section Headers" />
        <div className="flex flex-wrap gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="tertiary">Tertiary</Button>
          <Button variant="destructive">Destructive</Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Alert tone="info" title="Info" message="Benchmark comparison refreshed with the latest market window." />
          <Alert tone="success" title="Success" message="Validation run completed without critical exceptions." />
          <Alert tone="warning" title="Warning" message="Transaction-cost assumptions are pending confirmation." />
          <Alert tone="critical" title="Critical" message="Out-of-sample degradation exceeded tolerance threshold." />
        </div>
      </section>

      <section className="container-shell space-y-8 py-section-sm">
        <SectionHeader title="Dashboard Building Blocks" description="Metric tiles, analyst panels, upload intake, pricing, and report artifacts." />
        <div className="grid gap-6 md:grid-cols-4">
          <MetricCard label="Net Exposure" value="41%" helper="Average over 90 days" delta="+2.3%" tone="positive" />
          <MetricCard label="Tail Risk" value="Low" helper="Stress percentile" delta="Controlled" />
          <MetricCard label="Volatility" value="11.8%" helper="Annualized" delta="-0.9%" tone="positive" />
          <MetricCard label="Policy Breaches" value="1" helper="Last 30 days" delta="Review" tone="warning" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <InsightPanel />
          <UploadPanel />
        </div>
        <PricingCards />
        <div className="max-w-md">
          <ReportPreviewCard />
        </div>
      </section>

      <section id="charts" className="container-shell space-y-6 py-section-sm">
        <SectionHeader title="Chart Containers" description="Analytical shells with calm hierarchy and chart-ready framing." />
        <div className="grid gap-6">
          <ChartCard title="Line / Equity" subtitle="Strategy vs benchmark" chart={<MockLineChart />} footer="Primary red series represents strategy PnL; blue is benchmark reference." />
          <div className="grid gap-6 md:grid-cols-2">
            <ChartCard title="Distribution Histogram" chart={<MockHistogram />} />
            <ChartCard title="Regime Heatmap" chart={<MockHeatmap />} />
          </div>
          <ChartCard title="Multi-Metric Panel" chart={<MockMultiMetricPanel />} />
        </div>
      </section>

      <Footer groups={[{ title: "Navigation", links: [{ label: "Home", href: "/" }, { label: "UI Kit", href: "/ui-kit" }] }, { title: "System", links: [{ label: "Tokens", href: "#overview" }, { label: "Components", href: "#components" }] }]} />
    </main>
  );
}
