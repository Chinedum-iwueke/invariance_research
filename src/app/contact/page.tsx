import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public/public-shell";
import { ContactForm } from "@/components/public/contact-form";
import { ScrollspyRail } from "@/components/public/home-scenes";
import { PageHero } from "@/components/public/page-hero";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Contact | Invariance Research",
  description: "Contact Invariance Research to request strategy validation audit or discuss robustness diagnostics.",
};

export default function ContactPage() {
  const sectionIds = ["hero", "contact"];

  return (
    <PublicShell>
      <main className="relative">
        <ScrollspyRail sectionIds={sectionIds} />
        <section id="hero">
          <PageHero
            title="Request Strategy Validation"
            description="Share your strategy type and review goals. Engagements are handled with institutional confidentiality standards."
          />
        </section>

        <section id="contact" className="container-shell grid gap-6 py-section-sm md:grid-cols-[1.2fr_0.8fr]">
          <ContactForm />
          <Card className="h-fit space-y-4 p-card-md">
            <h2 className="text-lg font-semibold">Alternative contact</h2>
            <p className="text-sm text-text-neutral">For mandate scoping, partnership inquiries, or standards publications.</p>
            <div className="text-sm text-text-graphite">
              <p>
                Email:{" "}
                <Link href="mailto:admin@invarianceresearch.xyz" className="underline-offset-4 hover:underline">
                  admin@invarianceresearch.xyz
                </Link>
              </p>
              <p className="mt-2">Response window: 1–2 business days</p>
            </div>
            <p className="rounded-sm border bg-surface-panel p-3 text-xs text-text-neutral">
              All inquiries are treated with strict confidentiality and are not shared outside the engagement context.
            </p>
          </Card>
        </section>
      </main>
    </PublicShell>
  );
}
