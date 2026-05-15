import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public/public-shell";
import { CtaBanner } from "@/components/public/cta-banner";
import { ScrollspyRail } from "@/components/public/home-scenes";
import { SectionHeader } from "@/components/ui/section-header";
import { listPublishedVideos, resolveYouTubeThumbnail } from "@/lib/server/videos/repository";
import { listResearchLibrary } from "@/lib/server/publications/repository";
import { ResearchVideoLibrary } from "@/components/public/research-video-library";
import { EvidenceArtifactPreview } from "@/components/public/evidence-artifact-preview";
import type { PublicationRecord } from "@/lib/publications/model";

export const metadata: Metadata = { title: "Research & Education | Invariance Research", description: "Execution-aware backtesting, diagnostics, and research workflows." };
export const dynamic = "force-dynamic";

function titleizeCategory(category: string) {
  if (category === "research_standard") return "Research Standards";
  return category
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatPublishedDate(publishedAt: string | null) {
  if (!publishedAt) return "Unpublished";
  return new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(publishedAt));
}

function ResearchReportCard({ article }: { article: PublicationRecord }) {
  return (
    <article className="flex min-h-full flex-col justify-between rounded-sm border border-border-subtle bg-surface-paper p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-raised md:p-5">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-neutral">{titleizeCategory(article.category)}</p>
          <p className="text-xs text-text-neutral">{formatPublishedDate(article.published_at)}</p>
        </div>
        <div className="space-y-3">
          <h3 className="font-display text-2xl font-medium leading-tight">{article.title}</h3>
          <p className="text-sm leading-6 text-text-neutral">{article.summary}</p>
        </div>
      </div>
      <div className="mobile-cta-row mt-6">
        <Link href={`/research/${article.slug}`} className="rounded-sm bg-brand px-3 py-2 text-center text-sm font-medium text-white transition hover:bg-brand/90">
          Read Article
        </Link>
        {article.pdf_url ? (
          <Link href={article.pdf_url} className="rounded-sm border border-border-subtle px-3 py-2 text-center text-sm font-medium transition hover:bg-surface-panel">
            Download PDF
          </Link>
        ) : null}
      </div>
    </article>
  );
}

export default async function ResearchPage() {
  const sectionIds = ["hero", "video-library", "reports", "cta"];
  const library = await listResearchLibrary();
  const videos = (await listPublishedVideos()).map((v) => ({ ...v, thumbnail: resolveYouTubeThumbnail(v.youtube_url, v.thumbnail_override_url) }));
  return (
    <PublicShell>
      <main className="relative">
        <ScrollspyRail sectionIds={sectionIds} />
        <section id="hero" className="public-hero-band border-b border-border-subtle">
          <div className="container-shell grid gap-8 py-section-md md:grid-cols-[1fr_0.9fr] md:items-center md:gap-12 md:py-section-lg">
            <div className="space-y-5">
            <p className="eyebrow text-brand">Research & Education</p>
            <h1 className="font-display max-w-3xl text-[clamp(2.55rem,12vw,4.2rem)] font-medium leading-[0.96] text-text-institutional md:text-[clamp(4rem,6.4vw,5.6rem)]">Learn to validate strategies like a professional.</h1>
            <p className="max-w-3xl text-base leading-relaxed text-text-neutral md:text-lg">
              Execution-aware backtesting, robustness diagnostics, and research workflows for traders who want evidence before deployment.
            </p>
            <div className="mobile-cta-row">
              <a href="#video-library" className="rounded-sm bg-brand px-4 py-2.5 text-center text-sm font-medium text-white">
                Browse Video Library
              </a>
              <a href="#reports" className="rounded-sm border border-border-subtle bg-surface-panel px-4 py-2.5 text-center text-sm text-text-graphite">
                View Research Reports
              </a>
              <Link href="/contact" className="rounded-sm border border-border-subtle bg-surface-panel px-4 py-2.5 text-center text-sm text-text-graphite">
                Request Validation Audit
              </Link>
            </div>
            </div>
            <EvidenceArtifactPreview variant="report" />
          </div>
        </section>

        <section id="video-library" className="container-shell space-y-6 py-section-sm">
          <SectionHeader title="Video Library" description="Structured walkthroughs on execution-aware strategy validation, research methodology, and diagnostic workflows." />
          <ResearchVideoLibrary videos={videos} />
        </section>

        <section id="reports" className="container-shell space-y-6 py-section-sm">
          <SectionHeader title="Research Reports" description="Long-form validation frameworks, methodology documents, and structured research publications." />
          <div className="grid gap-5 md:grid-cols-2 md:gap-6">
            {library.collection.length > 0 ? (
              library.collection.map((article) => <ResearchReportCard key={article.id} article={article} />)
            ) : (
              <div className="rounded-sm border border-border-subtle bg-surface-panel/40 p-5 md:col-span-2">
                <p className="text-sm text-text-neutral">Published research reports will appear here.</p>
              </div>
            )}
          </div>
        </section>

        <section id="cta" className="container-shell py-section-md">
          <CtaBanner
            title="Need deeper validation before deployment?"
            description="For full-spectrum strategy review — including execution stress, regime diagnostics, parameter stability, and capital-risk interpretation — request an independent validation audit."
            primary={{ label: "Request Validation Audit", href: "/contact" }}
          />
        </section>
      </main>
    </PublicShell>
  );
}
