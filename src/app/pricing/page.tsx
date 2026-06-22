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
  description: "Pricing for research programs, hypotheses, experiment throughput, memory, reports, shares, and Research Desk escalation.",
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
            title="Research throughput plans"
            description="Start with a small research program. Upgrade when you need more hypotheses, queued experiments, compute units, assistant calls, memory, reports, shares, or Research Desk escalation."
            primaryCta={{ label: "Request Expert Review", href: "/contact" }}
            secondaryCta={{ label: "Explore Lab", href: "/signup" }}
            artifactVariant="lab"
          />
        </section>

        <section id="plans" className="container-shell space-y-6 py-section-sm">
          <SectionHeader title="Research Plans" description="Self-serve tiers are built around research programs, hypothesis drafting, experiment queues, compute credits, memory, audit imports, and report sharing. They do not turn weak evidence into stronger proof." />
          <PricingCards />
        </section>

        <section id="comparison" className="container-shell space-y-6 py-section-sm">
          <SectionHeader title="Plan Comparison" description="Capability matrix for research throughput, assistant usage, memory retention, audit imports, reports, share links, and Research Desk escalation." />
          <PlanComparisonTable />
          <Card className="p-card-md text-sm leading-6 text-text-neutral">
            Expert Review is the escalation path when automated experiments or imports cannot honestly support true parameter stability, multi-symbol state attribution, exchange-level execution realism, strategy reconstruction, portfolio exposure analysis, or an independent validation memo. <Link href="/contact" className="font-medium text-brand">Discuss scope.</Link>
          </Card>
        </section>

        <section id="cta" className="container-shell py-section-md">
          <CtaBanner
            title="Start with one falsifiable research program"
            description="Use imports when they help, but keep the operating loop focused on thesis, hypothesis, experiment, verdict, memory, and the next test."
            primary={{ label: "Sign Up", href: "/signup" }}
            secondary={{ label: "Request Expert Review", href: "/contact" }}
          />
        </section>
      </main>
    </PublicShell>
  );
}
