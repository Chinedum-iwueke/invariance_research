import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public/public-shell";
import { CtaBanner } from "@/components/public/cta-banner";
import { PageHero } from "@/components/public/page-hero";
import { ScrollspyRail } from "@/components/public/home-scenes";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";

export const metadata: Metadata = {
  title: "About | Invariance Research",
  description: "About Invariance Research, an independent quantitative validation studio focused on execution-aware diagnostics.",
};

export default function AboutPage() {
  const sectionIds = ["hero", "philosophy", "founder", "cta"];

  return (
    <PublicShell>
      <main className="relative">
        <ScrollspyRail sectionIds={sectionIds} />
        <section id="hero">
          <PageHero
            title="About Invariance Research"
            description="Invariance Research is an independent quantitative validation studio focused on execution-aware strategy evaluation, robustness diagnostics, and research systems built around disciplined methodology. The firm develops tools that reflect its validation philosophy — from the Strategy Robustness Lab already available today to the forthcoming Invariance Research Desk, an AI-native research environment designed to make backtesting more structured, realistic, and decision-grade."
            primaryCta={{ label: "Read Research Standards", href: "/research-standards" }}
            secondaryCta={{ label: "Contact", href: "/contact" }}
          />
        </section>

        <section id="philosophy" className="container-shell space-y-6 py-section-sm">
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

        <section id="founder" className="container-shell py-8 md:py-10">
          <div className="grid items-center gap-5 md:max-w-[46rem] md:gap-6">
            <div className="space-y-2.5 md:space-y-3">
              <p className="eyebrow">Founder</p>
              <h2 className="text-2xl font-semibold leading-tight md:text-3xl">Chinedum Iwueke</h2>
              <p className="text-sm text-text-neutral md:text-base">Independent Quantitative Validation Specialist</p>
              <p className="max-w-2xl text-xs leading-relaxed text-text-neutral md:text-sm">
                The validation framework is developed and operated with emphasis on transparent assumptions, reproducible diagnostics, and institutional-grade review standards.
              </p>
              <Link
                href="/about/chinedum-iwueke"
                className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-brand transition-transform duration-normal hover:translate-x-1 hover:opacity-90 md:text-sm md:normal-case md:tracking-normal"
              >
                Read Bio <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </section>

        <section id="cta" className="container-shell py-section-md">
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
