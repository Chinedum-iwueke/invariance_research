import type { Metadata } from "next";
import { DashboardMockShell } from "@/components/public/dashboard-mock-shell";
import { PublicShell } from "@/components/public/public-shell";
import { CtaBanner } from "@/components/public/cta-banner";
import { PageHero } from "@/components/public/page-hero";
import { ReportPreviewCard } from "@/components/ui/report-preview-card";
import { SectionHeader } from "@/components/ui/section-header";
import { UploadPanel } from "@/components/ui/upload-panel";
import { FeatureGrid } from "@/components/marketing/feature-grid";

export const metadata: Metadata = {
  title: "Strategy Robustness Lab | Invariance Research",
  description: "Execution-aware diagnostics platform for testing strategy resilience under realistic market conditions.",
};

export default function RobustnessLabPage() {
  return (
    <PublicShell>
      <main>
        <PageHero
          eyebrow="Product"
          title="Strategy Robustness Lab"
          description="A research instrument that tests whether strategies survive realistic execution and adverse market conditions."
          primaryCta={{ label: "Join Early Access", href: "/contact" }}
          secondaryCta={{ label: "View Pricing", href: "/pricing" }}
        />

        <section className="container-shell space-y-6 py-section-sm">
          <SectionHeader title="What it is" description="The lab converts strategy artifacts into structured diagnostics, stress outputs, and institutional report previews." />
          <div className="grid gap-6 md:grid-cols-2">
            <UploadPanel />
            <ReportPreviewCard />
          </div>
        </section>

        <section className="container-shell space-y-6 py-section-sm">
          <SectionHeader title="Who it is for" description="Designed for discretionary and systematic teams that require methodical pre-deployment validation." />
          <FeatureGrid columns={4} />
        </section>

        <section className="container-shell space-y-6 py-section-sm">
          <SectionHeader title="Diagnostics and Dashboard States" description="Placeholder shells demonstrate the analytical framing of final outputs." />
          <DashboardMockShell />
        </section>

        <section className="container-shell py-section-md">
          <CtaBanner
            title="Access the lab or request analyst support"
            description="Choose self-serve diagnostics for recurring reviews or advisory validation for deeper mandates."
            primary={{ label: "Request Access", href: "/contact" }}
            secondary={{ label: "Compare Plans", href: "/pricing" }}
          />
        </section>
      </main>
    </PublicShell>
  );
}
