import type { Metadata } from "next";
import { PublicShell } from "@/components/public/public-shell";
import { ConfidentialityCallout } from "@/components/public/confidentiality-callout";
import { ContactForm } from "@/components/public/contact-form";
import { CtaBanner } from "@/components/public/cta-banner";
import { PageHero } from "@/components/public/page-hero";
import { ProcessStepperCarouselCard, ScrollspyRail } from "@/components/public/home-scenes";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";

export const metadata: Metadata = {
  title: "Strategy Validation | Invariance Research",
  description: "Independent strategy validation engagements with execution-aware diagnostics and institutional reporting.",
};

export default function StrategyValidationPage() {
  const sectionIds = ["hero", "tiers", "deliverables", "process", "request", "cta"];

  return (
    <PublicShell>
      <main className="relative">
        <ScrollspyRail sectionIds={sectionIds} />
        <section id="hero">
          <PageHero
            title="Independent Strategy Validation"
            description="Structured advisory engagements for teams requiring deeper analyst-led evaluation than automated diagnostics alone."
            primaryCta={{ label: "Request Consultation", href: "#request" }}
            secondaryCta={{ label: "View Methodology", href: "/methodology" }}
          />
        </section>

        <section id="tiers" className="container-shell space-y-6 py-section-sm">
          <SectionHeader title="Audit Tiers" description="Tiered scope for exploratory, institutional, and bespoke validation mandates." />
          <div className="grid gap-6 md:grid-cols-3">
            {[
              ["Audit Foundation", "Single-strategy diagnostic baseline", "2–3 weeks"],
              ["Institutional Audit", "Multi-layer robustness and capital-risk review", "3–5 weeks"],
              ["Bespoke Engagement", "Custom mandate for complex portfolios", "Variable"],
            ].map(([tier, summary, window]) => (
              <Card key={tier} className="space-y-3 p-card-md">
                <h3 className="text-lg font-semibold">{tier}</h3>
                <p className="text-sm text-text-neutral">{summary}</p>
                <p className="text-xs uppercase tracking-[0.12em] text-text-neutral">Typical window: {window}</p>
              </Card>
            ))}
          </div>
        </section>

        <section id="deliverables" className="container-shell space-y-6 py-section-sm">
          <SectionHeader title="Core Deliverables" />
          <div className="grid gap-3 md:grid-cols-2">
            {[
              "Execution-aware backtest review",
              "Monte Carlo robustness testing",
              "Parameter stability analysis",
              "Regime performance diagnostics",
              "Capital risk modeling",
              "Structured validation report",
            ].map((item, index) => (
              <Card key={`validation-item-${index}-${item.slice(0, 24)}`} className="p-card-md text-sm text-text-graphite">
                {item}
              </Card>
            ))}
          </div>
          <ConfidentialityCallout />
        </section>

        <section id="process" className="container-shell space-y-6 py-section-sm">
          <SectionHeader title="Engagement Process" description="A structured analyst-led sequence from scoping through final delivery." />
          <ProcessStepperCarouselCard
            title="Engagement Process"
            subtitle="Each phase is designed to produce decision-ready evidence for teams evaluating live deployment."
            steps={[
              { title: "Scoping", body: "Define objectives, constraints, and material requirements.", note: "Step 1" },
              { title: "Data Intake", body: "Collect strategy artifacts and execution context.", note: "Step 2" },
              { title: "Validation", body: "Run diagnostics, stress testing, and sensitivity analysis.", note: "Step 3" },
              { title: "Review", body: "Analyst synthesis with committee-ready interpretation.", note: "Step 4" },
              { title: "Delivery", body: "Issue structured report and discussion session.", note: "Step 5" },
            ]}
          />
        </section>

        <section id="request" className="container-shell py-section-sm">
          <ContactForm />
        </section>

        <section id="cta" className="container-shell py-section-md">
          <CtaBanner
            title="Ready for independent review?"
            description="Submit your strategy context for a structured validation engagement."
            primary={{ label: "Request Strategy Audit", href: "/contact" }}
            secondary={{ label: "Explore Robustness Lab", href: "/robustness-lab" }}
          />
        </section>
      </main>
    </PublicShell>
  );
}
