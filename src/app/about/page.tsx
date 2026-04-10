import type { Metadata } from "next";
import Image from "next/image";
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
            description="Invariance Research is an independent quantitative validation studio focused on execution-aware strategy evaluation and robustness diagnostics."
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

        <section id="founder" className="container-shell py-section-md">
          <div className="grid items-center gap-10 md:grid-cols-[0.7fr_0.3fr] md:gap-12">
            <div className="space-y-4 md:space-y-5">
              <p className="eyebrow">Founder</p>
              <h2 className="text-3xl font-semibold leading-tight md:text-4xl">Chinedum Iwueke</h2>
              <p className="text-base text-text-neutral md:text-lg">Independent Quantitative Validation Specialist</p>
              <p className="max-w-3xl text-sm leading-relaxed text-text-neutral md:text-base">
                The validation framework is developed and operated with emphasis on transparent assumptions, reproducible diagnostics, and institutional-grade review standards.
              </p>
              <Link
                href="/about/chinedum-iwueke"
                className="inline-flex items-center gap-1 text-sm font-semibold text-brand transition-transform duration-normal hover:translate-x-1 hover:opacity-90"
              >
                Read Bio <span aria-hidden>→</span>
              </Link>
            </div>

            <Link href="/about/chinedum-iwueke" className="group relative mx-auto block w-full max-w-[22rem] overflow-hidden rounded-lg md:max-w-none">
              <div className="relative aspect-[4/5] w-full">
                <Image
                  src="/founder_image.png"
                  alt="Portrait of Chinedum Iwueke"
                  fill
                  className="object-cover object-center transition duration-slow group-hover:scale-[1.01]"
                />
              </div>
            </Link>
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
