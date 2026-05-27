import type { Metadata } from "next";
import { PublicShell } from "@/components/public/public-shell";
import { ConfidentialityCallout } from "@/components/public/confidentiality-callout";
import { ContactForm } from "@/components/public/contact-form";
import { CtaBanner } from "@/components/public/cta-banner";
import { PageHero } from "@/components/public/page-hero";
import { ProcessStepperCarouselCard, ScrollspyRail } from "@/components/public/home-scenes";
import { DeliverableLedger, StrategyValidationHeroInstrument, StrategyValidationScopeBoard } from "@/components/public/validation-page-scenes";
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
            description="Analyst-led validation for teams that need more than automated diagnostics: a scoped evidence review, execution-aware pressure testing, and a committee-ready report."
            primaryCta={{ label: "Request Consultation", href: "#request" }}
            secondaryCta={{ label: "View Methodology", href: "/methodology" }}
            credibilityLine="Use when capital, investors, or internal review need decision-grade evidence."
            rightSlot={<StrategyValidationHeroInstrument />}
          />
        </section>

        <section id="tiers" className="container-shell space-y-6 py-section-sm">
          <SectionHeader
            eyebrow="Mandate Design"
            title="Choose the level of scrutiny the decision deserves."
            description="The engagement tiers are not pricing cards. They are scopes of evidence: how much uncertainty needs to be reduced before the strategy moves forward."
          />
          <StrategyValidationScopeBoard />
        </section>

        <section id="deliverables" className="container-shell space-y-6 py-section-sm">
          <SectionHeader
            eyebrow="Deliverable Ledger"
            title="Each deliverable maps to a decision risk."
            description="Analyst-led validation is scoped as a structured evidence program, not a generic consulting package."
          />
          <DeliverableLedger
            items={[
              "Execution-aware backtest review",
              "Monte Carlo robustness testing",
              "Parameter stability analysis",
              "Regime performance diagnostics",
              "Capital risk modeling",
              "Structured validation report",
            ]}
          />
          <ConfidentialityCallout />
        </section>

        <section id="process" className="container-shell space-y-6 py-section-sm">
          <SectionHeader
            eyebrow="Engagement Flow"
            title="The process mirrors the product: scope, evidence, pressure, report."
            description="A structured analyst-led sequence from scoping through final delivery."
          />
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
            secondary={{ label: "Explore Truth Room", href: "/robustness-lab" }}
          />
        </section>
      </main>
    </PublicShell>
  );
}
