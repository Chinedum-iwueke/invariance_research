import type { Metadata } from "next";
import { PublicShell } from "@/components/public/public-shell";
import { PageHero } from "@/components/public/page-hero";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Terms of Use | Invariance Research",
  description: "Terms governing use of Invariance Research's website, diagnostic tools, research materials, validation services, and related products.",
};

const lastUpdated = "May 14, 2026";

const sections = [
  {
    title: "Acceptance of Terms",
    body: [
      "By accessing or using Invariance Research's website, free diagnostic tools, research materials, validation services, waitlists, reports, software features, or related digital products, you agree to these Terms of Use. If you do not agree, do not use the services.",
      "These Terms apply alongside any separate written agreement, order form, or engagement letter that governs a paid service.",
    ],
  },
  {
    title: "Nature of Services",
    body: [
      "Invariance Research provides quantitative research, diagnostic tooling, educational content, software workflows, and strategy validation services. The services are designed to help users evaluate methods, assumptions, data quality, execution realism, robustness, and risk characteristics.",
      "The services are informational and methodological. They are not a brokerage service, exchange, investment adviser platform, asset manager, signal provider, tax adviser, or law firm.",
    ],
  },
  {
    title: "No Investment, Financial, Legal, or Tax Advice",
    body: [
      "Invariance Research does not provide investment, financial, legal, accounting, regulatory, or tax advice. Nothing on the website, in a report, in a diagnostic output, or in communications from Invariance Research should be interpreted as advice tailored to any person's financial situation, objectives, constraints, or risk tolerance.",
      "Users remain solely responsible for seeking professional advice from appropriately licensed advisers before making financial, trading, legal, tax, or business decisions.",
    ],
  },
  {
    title: "No Trading Signals or Recommendations",
    body: [
      "Invariance Research does not recommend buying, selling, holding, shorting, allocating to, avoiding, or otherwise transacting in any security, derivative, cryptocurrency, commodity, currency, fund, strategy, or other asset.",
      "Any examples, datasets, charts, model outputs, or references to market instruments are provided for research and educational context only and are not trading signals, recommendations, solicitations, or offers.",
    ],
  },
  {
    title: "Strategy Validation Limitations",
    body: [
      "Backtests, simulations, diagnostics, stress tests, robustness studies, and model-based outputs are hypothetical and depend on assumptions, input data, constraints, fees, slippage, latency, liquidity, execution modeling, benchmark selection, and methodological choices.",
      "Past performance, simulated performance, hypothetical performance, and validation outputs do not guarantee future performance. Real trading can differ materially from modeled results because of market impact, order handling, behavioral decisions, data errors, unavailable liquidity, regime change, technology failures, and other risks.",
    ],
  },
  {
    title: "User Responsibilities",
    body: [
      "You are responsible for the accuracy, legality, completeness, and authorization of information, files, data, prompts, strategy descriptions, and materials you submit. You are also responsible for reviewing outputs before relying on them in any research or business process.",
      "You must independently evaluate all research conclusions, limitations, assumptions, and risks. You must not treat any diagnostic result as a substitute for your own due diligence, professional judgment, or risk controls.",
    ],
  },
  {
    title: "Uploaded Materials and Client Data",
    body: [
      "Uploaded materials may include trade logs, CSV files, backtest exports, research notes, reports, strategy metadata, model summaries, or other artifacts. You represent that you have the rights and permissions needed to submit those materials to Invariance Research.",
      "Invariance Research may process uploaded materials to provide requested diagnostics, analysis, reporting, storage, support, security, and service improvement. Unless separately agreed, you should not submit information that you are prohibited from sharing.",
    ],
  },
  {
    title: "Confidentiality and Submitted Strategy Information",
    body: [
      "Invariance Research understands that strategy artifacts, research hypotheses, trading rules, and performance data can be commercially sensitive. Invariance Research will use reasonable confidentiality-oriented handling practices for submitted strategy information.",
      "No public disclosure of submitted strategy information will be made without permission, except where required by law, necessary to operate the services, necessary to protect rights or security, or otherwise described in a separate agreement.",
    ],
  },
  {
    title: "Intellectual Property",
    body: [
      "The website, software, workflows, report structures, research frameworks, visual designs, text, graphics, diagnostics, trademarks, and other materials provided by Invariance Research are owned by Invariance Research or its licensors and are protected by intellectual property laws.",
      "You retain ownership of materials you submit, subject to the rights needed for Invariance Research to operate, analyze, secure, support, and improve the services. You may not copy, resell, reverse engineer, scrape, or misuse Invariance Research's proprietary materials except as expressly permitted.",
    ],
  },
  {
    title: "Research Reports, Educational Content, and Publications",
    body: [
      "Research reports, articles, standards, case studies, educational materials, and publications are provided for informational purposes. They may discuss methods, assumptions, risks, examples, and market behavior without providing personalized advice.",
      "Published materials may contain errors, omissions, outdated information, or views that change as research evolves. Invariance Research may revise or remove materials at any time.",
    ],
  },
  {
    title: "Free Tools and Experimental Features",
    body: [
      "Free tools, previews, diagnostics, waitlist products, beta features, and experimental functionality may be changed, limited, suspended, or discontinued at any time. They may produce incomplete, delayed, or inaccurate results.",
      "You should not rely on free or experimental features as a sole basis for trading, capital allocation, compliance, or operational decisions.",
    ],
  },
  {
    title: "AI-Assisted Features and Automated Analysis",
    body: [
      "Some services may use AI-assisted interpretation, automated scoring, model-based summarization, or rule-driven diagnostics. These systems can make mistakes, omit context, or produce outputs that require human review.",
      "AI-assisted or automated outputs are informational and methodological. They do not create investment advice, fiduciary duties, trading recommendations, or guarantees of correctness.",
    ],
  },
  {
    title: "Third-Party Services",
    body: [
      "The services may rely on third-party providers for hosting, databases, storage, authentication, payments, analytics, email, infrastructure, model systems, or other operational functions. Those providers may have their own terms and policies.",
      "Invariance Research is not responsible for third-party products, data sources, outages, errors, or external websites that are not controlled by Invariance Research.",
    ],
  },
  {
    title: "Accounts and Access",
    body: [
      "Certain services may require an account, invitation, subscription, or administrative approval. You are responsible for keeping credentials secure and for all activity under your account.",
      "Invariance Research may restrict, suspend, or terminate access if it believes the services are being misused, security is at risk, payment obligations are not met, or continued access would create legal, operational, or reputational risk.",
    ],
  },
  {
    title: "Prohibited Uses",
    body: [
      "You may not use the services to violate law, infringe rights, attack systems, bypass access controls, upload malicious code, scrape or exfiltrate data, misrepresent outputs, resell unauthorized access, or submit materials you are not permitted to share.",
      "You may not present Invariance Research outputs as final legal, compliance, audit, regulatory, or investment-advice determinations unless separately agreed in writing and reviewed by appropriate professionals.",
    ],
  },
  {
    title: "Disclaimers",
    body: [
      "The services are provided on an as-is and as-available basis. To the fullest extent permitted by law, Invariance Research disclaims warranties of accuracy, completeness, reliability, merchantability, fitness for a particular purpose, non-infringement, uninterrupted availability, and error-free operation.",
      "Financial markets involve substantial risk. Diagnostics may be useful for research discipline, but they cannot eliminate uncertainty, model risk, execution risk, liquidity risk, or loss risk.",
    ],
  },
  {
    title: "Limitation of Liability",
    body: [
      "To the fullest extent permitted by law, Invariance Research will not be liable for indirect, incidental, consequential, special, exemplary, punitive, or lost-profit damages, or for trading losses, investment losses, business interruption, data loss, or reliance on diagnostic outputs.",
      "Any aggregate liability arising from the services will be limited to the amount paid by you to Invariance Research for the relevant service during the three months before the event giving rise to the claim, or one hundred U.S. dollars if no amount was paid.",
    ],
  },
  {
    title: "Indemnification",
    body: [
      "You agree to defend, indemnify, and hold harmless Invariance Research from claims, losses, liabilities, damages, costs, and expenses arising from your use of the services, submitted materials, violation of these Terms, infringement of rights, or misuse of research outputs.",
    ],
  },
  {
    title: "Changes to Services or Terms",
    body: [
      "Invariance Research may modify, suspend, or discontinue services and may update these Terms from time to time. Updated Terms will be posted on this page with a revised last-updated date.",
      "Continued use of the services after changes become effective means you accept the updated Terms.",
    ],
  },
  {
    title: "Governing Law",
    body: [
      "Any dispute or claim will be handled under the governing law, venue, and dispute-resolution terms specified in the applicable customer agreement or order form. Where no separate agreement applies, Invariance Research will apply the terms presented at the time the service is used.",
    ],
  },
  {
    title: "Contact",
    body: ["Questions about these Terms may be sent to admin@invarianceresearch.xyz."],
  },
] as const;

export default function TermsPage() {
  return (
    <PublicShell>
      <main className="bg-surface-white">
        <PageHero
          eyebrow="Legal"
          title="Terms of Use"
          description="These Terms govern use of Invariance Research's website, free diagnostic tools, research materials, validation services, and related digital products."
          credibilityLine={`Last updated: ${lastUpdated}`}
          artifactVariant="legal"
        />

        <section className="container-shell pb-section-lg">
          <Card className="public-legal-doc">
            <div className="space-y-8">
              {sections.map((section, index) => (
                <section key={section.title} className="border-b border-border-subtle/70 pb-7 last:border-b-0 last:pb-0">
                  <h2 className="text-lg font-semibold leading-tight text-text-institutional">
                    {index + 1}. {section.title}
                  </h2>
                  <div className="mt-3 space-y-3 text-sm leading-[1.75] text-text-neutral md:text-base">
                    {section.body.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </Card>
        </section>
      </main>
    </PublicShell>
  );
}
