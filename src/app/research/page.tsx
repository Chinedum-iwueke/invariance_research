import type { Metadata } from "next";
import { PublicShell } from "@/components/public/public-shell";
import { ArticleCard } from "@/components/public/article-card";
import { CtaBanner } from "@/components/public/cta-banner";
import { PageHero } from "@/components/public/page-hero";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { featuredResearch } from "@/content/site";

export const metadata: Metadata = {
  title: "Research & Case Studies | Invariance Research",
  description: "Case-study style research on robustness diagnostics, execution modeling, and strategy fragility.",
};

const additionalArticles = [
  {
    title: "The Hidden Fragility of Momentum Systems",
    category: "Case Study",
    summary: "Stability analysis across transaction-cost assumptions and volatility regimes.",
  },
  {
    title: "Regime Drift and False Confidence in Backtests",
    category: "Research Note",
    summary: "Why static assumptions conceal changing market microstructure and execution feasibility.",
  },
  {
    title: "Risk-of-Ruin Diagnostics for Levered Strategies",
    category: "Capital Risk",
    summary: "A framework for linking distribution tails to practical capital policy decisions.",
  },
] as const;

export default function ResearchPage() {
  return (
    <PublicShell>
      <main>
        <PageHero
          eyebrow="Research"
          title="Research & Case Studies"
          description="Method-driven publications exploring strategy fragility, execution realities, and validation standards."
          primaryCta={{ label: "Read Research Standards", href: "/research-standards" }}
          secondaryCta={{ label: "Request Audit", href: "/contact" }}
        />

        <section className="container-shell space-y-6 py-section-sm">
          <SectionHeader title="Featured Studies" />
          <div className="grid gap-6 md:grid-cols-3">
            {featuredResearch.map((article) => (
              <ArticleCard key={article.title} {...article} />
            ))}
          </div>
        </section>

        <section className="container-shell space-y-6 py-section-sm">
          <SectionHeader title="Research Library" description="Structured placeholders for future long-form publications." />
          <div className="flex flex-wrap gap-2">
            {[
              "All Topics",
              "Execution",
              "Robustness",
              "Capital Risk",
              "Case Studies",
            ].map((filter) => (
              <Button key={filter} size="sm" variant={filter === "All Topics" ? "primary" : "secondary"}>
                {filter}
              </Button>
            ))}
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {additionalArticles.map((article) => (
              <ArticleCard key={article.title} {...article} />
            ))}
          </div>
        </section>

        <section className="container-shell py-section-md">
          <CtaBanner
            title="Need a case-study style review of your strategy?"
            description="Translate raw strategy behavior into a structured validation narrative for stakeholders."
            primary={{ label: "Request Validation Audit", href: "/contact" }}
            secondary={{ label: "Explore Methodology", href: "/methodology" }}
          />
        </section>
      </main>
    </PublicShell>
  );
}
