import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public/public-shell";
import { CtaBanner } from "@/components/public/cta-banner";
import { PageHero } from "@/components/public/page-hero";
import { ScrollspyRail } from "@/components/public/home-scenes";
import { PricingCards } from "@/components/ui/pricing-cards";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { PlanComparisonTable } from "@/components/dashboard/plan-comparison-table";

export const metadata: Metadata = {
  title: "Pricing | Invariance Research",
  description: "Transparent launch-plan structure for Strategy Robustness Lab access and advisory validation pathways.",
};

export default function PricingPage() {
  const sectionIds = ["hero", "plans", "comparison", "cta"];

  return (
    <PublicShell>
      <main className="relative">
        <ScrollspyRail sectionIds={sectionIds} />
        <section id="hero">
          <PageHero
            eyebrow="Pricing"
            title="Access Plans and Validation Engagements"
            description="Choose self-serve lab access for evidence-gated validation, or Research Desk review when the uploaded artifacts cannot honestly support the decision you need to make."
            primaryCta={{ label: "Request Research Desk", href: "/contact" }}
            secondaryCta={{ label: "Explore Lab", href: "/signup" }}
            artifactVariant="lab"
          />
        </section>

        <section id="plans" className="container-shell space-y-6 py-section-sm">
          <SectionHeader title="Lab Plans" description="Automated tiers expand workflow capacity and diagnostic access. They do not override artifact limits." />
          <PricingCards />
        </section>

        <section id="comparison" className="container-shell space-y-6 py-section-sm">
          <SectionHeader title="Plan Comparison" description="Capability matrix aligned to in-app billing entitlements and diagnostic access boundaries." />
          <PlanComparisonTable />
          <Card className="p-card-md text-sm leading-6 text-text-neutral">
            Research Desk is the escalation path for true parameter stability, multi-asset regime attribution, broker-level execution realism, strategy reconstruction from config/report, portfolio-level exposure analysis, and independent validation memos. <Link href="/contact" className="font-medium text-brand">Discuss scope.</Link>
          </Card>
        </section>

        <section id="cta" className="container-shell py-section-md">
          <CtaBanner
            title="Select a validation path"
            description="Start with platform access for direct workflow control, or request Research Desk when the missing evidence affects a real deployment, sale, allocation, or evaluation decision."
            primary={{ label: "Sign Up", href: "/signup" }}
            secondary={{ label: "Request Research Desk", href: "/contact" }}
          />
        </section>
      </main>
    </PublicShell>
  );
}
