import { ChartCard } from "@/components/charts/chart-card";
import { MockLineChart } from "@/components/charts/chart-mocks";
import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";
import { CtaSection } from "@/components/marketing/cta-section";
import { FeatureGrid } from "@/components/marketing/feature-grid";
import { HeroSection } from "@/components/marketing/hero-section";
import { MetricCard } from "@/components/ui/metric-card";
import { SectionHeader } from "@/components/ui/section-header";

export default function HomePage() {
  return (
    <main>
      <Navbar links={[{ label: "Platform", href: "/ui-kit" }, { label: "Methodology", href: "#" }, { label: "Research", href: "#" }]} />
      <HeroSection
        eyebrow="Institutional Quantitative Research"
        title="Independent strategy validation for rigorous capital decisions"
        description="A calibrated product shell for diagnostics, reporting, and research governance."
        credibility="Used by allocator teams, PM offices, and quantitative governance committees."
        visualSlot={<ChartCard title="Composite Equity Curve" subtitle="36 months" chart={<MockLineChart />} />}
      />

      <section className="container-shell space-y-8 py-section-md">
        <SectionHeader
          eyebrow="Foundation"
          title="System primitives for phase-two page assembly"
          description="Tokens, cards, alerts, and analytical shells are aligned to institutional design rules."
        />
        <div className="grid gap-6 md:grid-cols-3">
          <MetricCard label="Validated Strategies" value="42" helper="Current active validations" delta="+6 this quarter" tone="positive" />
          <MetricCard label="Median Drawdown" value="-8.4%" helper="Cross-portfolio observation" delta="Stable" />
          <MetricCard label="Flagged Anomalies" value="03" helper="Requiring analyst review" delta="Needs attention" tone="warning" />
        </div>
      </section>

      <section className="container-shell space-y-8 py-section-sm">
        <SectionHeader eyebrow="Capabilities" title="Research-grade modules" />
        <FeatureGrid columns={3} />
      </section>

      <section className="container-shell py-section-sm">
        <CtaSection />
      </section>
      <Footer groups={[{ title: "Platform", links: [{ label: "UI Kit", href: "/ui-kit" }, { label: "Documentation", href: "/docs" }] }, { title: "Legal", links: [{ label: "Privacy", href: "#" }, { label: "Terms", href: "#" }] }]} />
    </main>
  );
}
