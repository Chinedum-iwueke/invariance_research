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
  description: "Transparent four-tier plan structure for Strategy Robustness Lab access and advisory validation pathways.",
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
            description="Choose self-serve lab access for recurring validation or advisory scope for analyst-led, institutional review."
            primaryCta={{ label: "Request Audit", href: "/contact" }}
            secondaryCta={{ label: "Explore Lab", href: "/signup" }}
          />
        </section>

        <section id="plans" className="container-shell space-y-6 py-section-sm">
          <SectionHeader title="Lab Plans" description="The same four-tier plan architecture used in app billing, adapted for public plan selection." />
          <PricingCards />
        </section>

        <section id="comparison" className="container-shell space-y-6 py-section-sm">
          <SectionHeader title="Plan Comparison" description="Capability matrix aligned to in-app billing entitlements and diagnostic access boundaries." />
          <PlanComparisonTable />
          <Card className="p-card-md text-sm text-text-neutral">
            Advisory engagements extend the platform with analyst-led interpretation, institutional review context, and custom operating constraints. <Link href="/contact" className="font-medium text-brand">Discuss scope.</Link>
          </Card>
        </section>

        <section id="cta" className="container-shell py-section-md">
          <CtaBanner
            title="Select a validation path"
            description="Start with platform access for direct workflow control, or request analyst-led strategy audit support."
            primary={{ label: "Sign Up", href: "/signup" }}
            secondary={{ label: "Request Strategy Audit", href: "/contact" }}
          />
        </section>
      </main>
    </PublicShell>
  );
}
