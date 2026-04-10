import type { Metadata } from "next";
import { PublicShell } from "@/components/public/public-shell";
import { CtaBanner } from "@/components/public/cta-banner";
import { PageHero } from "@/components/public/page-hero";
import { ScrollspyRail } from "@/components/public/home-scenes";
import { Card } from "@/components/ui/card";
import { PublicationArticle } from "@/components/public/publication-article";
import { resolvePublicationContent } from "@/lib/publications/content";
import { resolveActiveResearchStandard } from "@/lib/server/publications/repository";

export const metadata: Metadata = {
  title: "Research Standards | Invariance Research",
  description: "Institutional validation standards for execution-aware strategy evaluation and robustness diagnostics.",
};

export default function ResearchStandardsPage() {
  const sectionIds = ["hero", "article", "cta"];
  const activeStandard = resolveActiveResearchStandard();

  return (
    <PublicShell>
      <main className="relative">
        <ScrollspyRail sectionIds={sectionIds} />
        <section id="hero">
          <PageHero
            eyebrow="Research Standards"
            title="Research Standards"
            description="Institutional guidance for validating quantitative strategies under realistic execution and market stress conditions."
            primaryCta={{ label: activeStandard ? "Read Online" : "Browse Research", href: activeStandard ? "#article" : "/research" }}
            secondaryCta={{ label: activeStandard ? "Download PDF" : "View Methodology", href: activeStandard?.pdf_url ?? "/methodology" }}
          />
        </section>

        <section id="article">
          {activeStandard ? (
            <PublicationArticle publication={activeStandard} content={resolvePublicationContent(activeStandard)} showBackToLibrary={false} />
          ) : (
            <div className="container-shell py-section-sm">
              <Card className="p-card-lg">
                <p className="text-sm text-text-neutral">No published research standard is active yet. Publish one through admin or the manual content source.</p>
              </Card>
            </div>
          )}
        </section>

        <section id="cta" className="container-shell py-section-md">
          <CtaBanner
            title="Apply the standards to your strategy pipeline"
            description="Use the Robustness Lab for automated diagnostics or request an independent analyst audit."
            primary={{ label: "Explore Robustness Lab", href: "/robustness-lab" }}
            secondary={{ label: "Request Strategy Audit", href: "/contact" }}
          />
        </section>
      </main>
    </PublicShell>
  );
}
