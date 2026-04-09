import type { Metadata } from "next";
import { PublicShell } from "@/components/public/public-shell";
import { ArticleCard } from "@/components/public/article-card";
import { CtaBanner } from "@/components/public/cta-banner";
import { PageHero } from "@/components/public/page-hero";
import { ScrollspyRail } from "@/components/public/home-scenes";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { listResearchLibrary } from "@/lib/server/publications/repository";

export const metadata: Metadata = {
  title: "Research & Case Studies | Invariance Research",
  description: "Case-study style research on robustness diagnostics, execution modeling, and strategy fragility.",
};

function titleizeCategory(category: string) {
  return category.replaceAll("_", " ");
}

export default function ResearchPage() {
  const sectionIds = ["hero", "featured", "library", "cta"];
  const library = listResearchLibrary();

  return (
    <PublicShell>
      <main className="relative">
        <ScrollspyRail sectionIds={sectionIds} />
        <section id="hero">
          <PageHero
            eyebrow="Research"
            title="Research & Case Studies"
            description="Method-driven publications exploring strategy fragility, execution realities, and validation standards."
            primaryCta={{ label: "Read Research Standards", href: "/research-standards" }}
            secondaryCta={{ label: "Request Audit", href: "/contact" }}
          />
        </section>

        <section id="featured" className="container-shell space-y-6 py-section-sm">
          <SectionHeader title="Featured Studies" />
          <div className="grid gap-6 md:grid-cols-3">
            {library.featured.length > 0 ? library.featured.map((article) => (
              <ArticleCard key={article.id} title={article.title} category={titleizeCategory(article.category)} summary={article.summary} href={`/research/${article.slug}`} coverImageUrl={article.cover_image_url} featured={article.featured} />
            )) : <p className="text-sm text-text-neutral">No featured publications are live yet.</p>}
          </div>
        </section>

        <section id="library" className="container-shell space-y-6 py-section-sm">
          <SectionHeader title="Research Library" description="Published case studies and research notes sourced from the shared publication model." />
          <div className="flex flex-wrap gap-2">
            {["All Topics", ...library.taxonomy.map((item) => item[0].toUpperCase() + item.slice(1))].map((filter) => (
              <Button key={filter} size="sm" variant={filter === "All Topics" ? "primary" : "secondary"}>
                {filter}
              </Button>
            ))}
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {library.collection.length > 0 ? library.collection.map((article) => (
              <ArticleCard key={article.id} title={article.title} category={titleizeCategory(article.category)} summary={article.summary} href={`/research/${article.slug}`} coverImageUrl={article.cover_image_url} featured={article.featured} />
            )) : <p className="text-sm text-text-neutral">No published case studies or research notes available.</p>}
          </div>
        </section>

        <section id="cta" className="container-shell py-section-md">
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
