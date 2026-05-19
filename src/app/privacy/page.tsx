import type { Metadata } from "next";
import { PublicShell } from "@/components/public/public-shell";
import { PageHero } from "@/components/public/page-hero";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Privacy Policy | Invariance Research",
  description: "Privacy Policy for Invariance Research's website, diagnostic tools, research pages, waitlists, contact forms, and related services.",
};

const lastUpdated = "May 14, 2026";

const sections = [
  {
    title: "Information We Collect",
    body: [
      "Invariance Research may collect account information such as name, email address, authentication identifiers, organization, plan status, and account preferences.",
      "We may collect contact and waitlist information submitted through forms, including name, email address, role, company, research interests, intended use cases, and communications preferences.",
      "We may collect uploaded research artifacts, including trade data, CSVs, reports, strategy metadata, backtest exports, diagnostic inputs, notes, and related files submitted for analysis.",
      "We may collect usage and diagnostic metadata, including tool activity, analysis status, feature interactions, report generation events, timestamps, and operational workflow metadata.",
      "If payments or subscriptions are enabled, we may collect payment and subscription metadata such as plan, billing status, transaction references, and customer identifiers. We do not intend to store full payment card details directly.",
      "We may collect technical logs and analytics such as IP address, device and browser information, referrer, pages visited, session events, error logs, security events, and infrastructure telemetry.",
    ],
  },
  {
    title: "How We Use Information",
    body: [
      "We use information to provide services, operate accounts, process uploads, run diagnostics, generate reports, manage waitlists, respond to inquiries, and deliver requested research workflows.",
      "We use information to improve tools, evaluate reliability, debug errors, maintain security, prevent misuse, enforce terms, and understand how users interact with public pages and product features.",
      "We may use information to communicate with users about service updates, research/report workflows, account activity, waitlist invitations, support requests, billing or subscription matters, and administrative notices.",
    ],
  },
  {
    title: "Uploaded Files and Strategy Artifacts",
    body: [
      "Uploaded files and strategy artifacts may include trade data, CSVs, reports, strategy rules, portfolio metadata, performance exports, research notes, or other commercially sensitive materials.",
      "Unless otherwise agreed, uploaded artifacts are used to provide the requested analysis, diagnostics, storage, support, security, and related service functionality. We do not sell uploaded strategy artifacts.",
      "Users should only upload materials they are authorized to submit and should avoid submitting information that is restricted by employer, client, exchange, vendor, confidentiality, or legal obligations.",
    ],
  },
  {
    title: "Confidentiality-Oriented Handling",
    body: [
      "Invariance Research recognizes that strategy artifacts, trading records, model notes, and research hypotheses can be sensitive. We use reasonable technical and organizational safeguards designed to limit unauthorized access, disclosure, alteration, and misuse.",
      "We do not publicly disclose submitted strategy artifacts without permission, except where required by law, necessary to operate or secure the services, necessary to respond to user requests, or otherwise covered by a separate agreement.",
    ],
  },
  {
    title: "AI-Assisted Processing",
    body: [
      "Uploaded materials, derived metrics, and diagnostic summaries may be processed by internal, local, or configured model systems to support interpretation, summarization, classification, report drafting, and workflow assistance.",
      "This policy does not imply that submitted strategy artifacts are used for public model training. Material changes to model processing, retention, or training treatment will be reflected in an updated policy before they are introduced.",
      "AI-assisted summaries can be incomplete or incorrect and are used as part of a research workflow rather than as autonomous investment, legal, tax, or compliance advice.",
    ],
  },
  {
    title: "Cookies and Authentication",
    body: [
      "We may use cookies, local storage, session tokens, and similar technologies to support authentication, account security, user preferences, form behavior, fraud prevention, and basic site functionality.",
      "Disabling cookies may limit access to authenticated services, saved sessions, or diagnostic workflows.",
    ],
  },
  {
    title: "Analytics",
    body: [
      "We may use privacy-conscious analytics and technical telemetry to understand page performance, feature usage, conversion funnels, errors, and operational reliability.",
      "Analytics data is used to improve the website, tools, research workflows, and product experience. We aim to minimize unnecessary personal information in analytics where feasible.",
    ],
  },
  {
    title: "Third-Party Providers",
    body: [
      "We may share limited information with service providers that help operate the business, including hosting, database, storage, payments, authentication, email, communications, analytics, security, infrastructure, and support providers.",
      "These providers are expected to process information for operational purposes connected to the services. Their handling of information may also be governed by their own terms, privacy policies, and data-processing commitments.",
    ],
  },
  {
    title: "Data Retention",
    body: [
      "We retain information for as long as reasonably needed to provide services, maintain accounts, complete diagnostics, preserve reports, support users, comply with legal obligations, resolve disputes, maintain security, and improve operations.",
      "Retention periods may vary by data type, account status, subscription status, legal requirements, backup cycles, and operational needs. Users may request deletion, subject to legal, security, contractual, and technical limitations.",
    ],
  },
  {
    title: "Data Security",
    body: [
      "We use reasonable safeguards intended to protect information against unauthorized access, loss, misuse, disclosure, alteration, and destruction. These may include access controls, authentication, infrastructure security, logging, least-privilege practices, and storage controls.",
      "No system is perfectly secure. Users are responsible for protecting account credentials, limiting uploaded sensitive information to what is necessary, and promptly notifying us of suspected unauthorized access.",
    ],
  },
  {
    title: "User Rights and Requests",
    body: [
      "Depending on location and applicable law, users may have rights to request access, correction, deletion, portability, restriction, objection, or withdrawal of consent for certain personal information.",
      "Requests can be sent to admin@invarianceresearch.xyz. We may need to verify identity and may decline or limit requests where permitted by law or necessary for security, legal compliance, dispute resolution, or service integrity.",
    ],
  },
  {
    title: "International Users",
    body: [
      "If you access the services from outside the country where Invariance Research or its providers operate, your information may be processed in jurisdictions with different privacy and data protection laws than your own.",
      "By using the services, you understand that information may be transferred, stored, and processed where Invariance Research and its service providers maintain operations.",
    ],
  },
  {
    title: "Children's Privacy",
    body: [
      "The services are intended for professional, research, and business users and are not directed to children. Invariance Research does not knowingly collect personal information from children under 13.",
      "If we learn that a child has submitted personal information, we will take reasonable steps to delete it where required.",
    ],
  },
  {
    title: "Changes to this Policy",
    body: [
      "We may update this Privacy Policy as the website, tools, providers, or data practices evolve. Updated versions will be posted on this page with a revised last-updated date.",
      "Material changes involving uploaded artifacts, AI-assisted processing, retention, or third-party providers will be reflected on this page.",
    ],
  },
  {
    title: "Contact",
    body: ["Questions or requests about this Privacy Policy may be sent to admin@invarianceresearch.xyz."],
  },
] as const;

export default function PrivacyPage() {
  return (
    <PublicShell>
      <main className="bg-surface-white">
        <PageHero
          eyebrow="Legal"
          title="Privacy Policy"
          description="This Privacy Policy explains how Invariance Research collects, uses, stores, and protects information submitted through the website, free diagnostic tools, research pages, waitlists, contact forms, and related services."
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
