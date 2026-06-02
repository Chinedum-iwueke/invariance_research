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
  description: "Pricing for trade-history validation, core robustness diagnostics, prop evaluation, exports, shares, and Research Desk escalation.",
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
            title="Strategy validation plans"
            description="Start with trade-history validation. Upgrade when you need exports, shareable memos, saved prop profiles, or Research Desk escalation."
            primaryCta={{ label: "Request Research Desk", href: "/contact" }}
            secondaryCta={{ label: "Explore Lab", href: "/signup" }}
            artifactVariant="lab"
          />
        </section>

        <section id="plans" className="container-shell space-y-6 py-section-sm">
          <SectionHeader title="Validation Plans" description="Self-serve tiers are built around trade CSVs, exchange exports, core robustness diagnostics, prop evaluation rules, survival stress, and report sharing. They do not turn weak evidence into stronger proof." />
          <PricingCards />
        </section>

        <section id="comparison" className="container-shell space-y-6 py-section-sm">
          <SectionHeader title="Plan Comparison" description="Capability matrix for trade-history validation, prop evaluation, report exports, share links, and Research Desk escalation." />
          <PlanComparisonTable />
          <Card className="p-card-md text-sm leading-6 text-text-neutral">
            Research Desk is the escalation path when a trade-history upload cannot honestly support true parameter stability, multi-asset regime attribution, broker-level execution realism, strategy reconstruction, portfolio exposure analysis, or an independent validation memo. <Link href="/contact" className="font-medium text-brand">Discuss scope.</Link>
          </Card>
        </section>

        <section id="cta" className="container-shell py-section-md">
          <CtaBanner
            title="Start with the evidence you already have"
            description="Run the trade-history validation first. Request Research Desk only when missing evidence affects a real deployment, sale, allocation, or evaluation decision."
            primary={{ label: "Sign Up", href: "/signup" }}
            secondary={{ label: "Request Research Desk", href: "/contact" }}
          />
        </section>
      </main>
    </PublicShell>
  );
}
