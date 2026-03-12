import type { Metadata } from "next";
import { PublicShell } from "@/components/public/public-shell";
import { CtaBanner } from "@/components/public/cta-banner";
import { PageHero } from "@/components/public/page-hero";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";

export const metadata: Metadata = {
  title: "About | Invariance Research",
  description: "About Invariance Research, an independent quantitative validation studio focused on execution-aware diagnostics.",
};

export default function AboutPage() {
  return (
    <PublicShell>
      <main>
        <PageHero
          eyebrow="About"
          title="About Invariance Research"
          description="Invariance Research is an independent quantitative validation studio focused on execution-aware strategy evaluation and robustness diagnostics."
          primaryCta={{ label: "Read Research Standards", href: "/research-standards" }}
          secondaryCta={{ label: "Contact", href: "/contact" }}
        />

        <section className="container-shell space-y-6 py-section-sm">
          <SectionHeader title="Research philosophy" description="Methodology-first validation designed to reduce false confidence before capital deployment." />
          <div className="grid gap-4 md:grid-cols-3">
            {[
              "Execution realism before performance claims",
              "Robustness over isolated backtest outcomes",
              "Structured reporting for capital decision clarity",
            ].map((principle) => (
              <Card key={principle} className="p-card-md text-sm text-text-graphite">
                {principle}
              </Card>
            ))}
          </div>
        </section>

        <section className="container-shell py-section-sm">
          <Card className="max-w-2xl p-card-lg">
            <p className="eyebrow">Operator</p>
            <h2 className="mt-2 text-2xl font-semibold">Chinedum Iwueke</h2>
            <p className="mt-1 text-sm text-text-neutral">Independent Quantitative Validation Specialist</p>
            <p className="mt-4 text-sm leading-relaxed text-text-neutral">
              The validation framework is developed and operated with emphasis on transparent assumptions, reproducible diagnostics, and institutional-grade review standards.
            </p>
          </Card>
        </section>

        <section className="container-shell py-section-md">
          <CtaBanner
            title="Apply a disciplined validation process"
            description="Use the Robustness Lab or commission a bespoke strategy review."
            primary={{ label: "Explore Robustness Lab", href: "/robustness-lab" }}
            secondary={{ label: "Request Audit", href: "/contact" }}
          />
        </section>
      </main>
    </PublicShell>
  );
}
