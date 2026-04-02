import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public/public-shell";
import { CtaBanner } from "@/components/public/cta-banner";
import { PageHero } from "@/components/public/page-hero";
import { PricingCards } from "@/components/ui/pricing-cards";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";

export const metadata: Metadata = {
  title: "Pricing | Invariance Research",
  description: "Restrained pricing for Strategy Robustness Lab access tiers and bespoke consulting validation engagements.",
};

export default function PricingPage() {
  return (
    <PublicShell>
      <main>
        <PageHero
          eyebrow="Pricing"
          title="Access Plans and Validation Engagements"
          description="Choose diagnostic platform access or bespoke consulting mandates based on review depth and operational complexity."
          primaryCta={{ label: "Request Audit", href: "/contact" }}
          secondaryCta={{ label: "Explore Lab", href: "/robustness-lab" }}
        />

        <section className="container-shell space-y-6 py-section-sm">
          <SectionHeader title="Lab Plans" description="Foundational and institutional tiers for recurring diagnostics." />
          <PricingCards />
        </section>

        <section className="container-shell space-y-6 py-section-sm">
          <SectionHeader title="Plan Comparison" />
          <Card className="overflow-hidden p-0">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-panel">
                <tr>
                  <th className="p-3 font-semibold">Capability</th>
                  <th className="p-3 font-semibold">Free / Limited</th>
                  <th className="p-3 font-semibold">Pro Diagnostics</th>
                  <th className="p-3 font-semibold">Consulting</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Strategy uploads", "2/month", "Unlimited", "Analyst-managed"],
                  ["Diagnostics depth", "Core checks", "Full test suite", "Custom mandate"],
                  ["Reporting", "Summary", "Detailed", "Committee-ready"],
                  ["Support", "Community", "Priority", "Dedicated analyst"],
                ].map((row, rowIndex) => (
                  <tr key={`${row[0]}-${rowIndex}`} className="border-t">
                    {row.map((cell, cellIndex) => (
                      <td key={`${row[0]}-cell-${cellIndex}-${cell}`} className="p-3 text-text-graphite">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card className="p-card-md text-sm text-text-neutral">
            Custom validation engagements are available for portfolio-level reviews and specialized execution environments. <Link href="/contact" className="font-medium text-brand">Discuss scope.</Link>
          </Card>
        </section>

        <section className="container-shell py-section-md">
          <CtaBanner
            title="Select a validation path"
            description="Start with diagnostics access or move directly into analyst-led strategy review."
            primary={{ label: "Join the Lab", href: "/robustness-lab" }}
            secondary={{ label: "Request Strategy Audit", href: "/contact" }}
          />
        </section>
      </main>
    </PublicShell>
  );
}
