import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public/public-shell";
import { CtaBanner } from "@/components/public/cta-banner";
import { ScrollspyRail } from "@/components/public/home-scenes";
import { SectionHeader } from "@/components/ui/section-header";
import { listPublishedVideos, resolveYouTubeThumbnail } from "@/lib/server/videos/repository";
import { listResearchLibrary } from "@/lib/server/publications/repository";
import { ResearchVideoLibrary } from "@/components/public/research-video-library";
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
    <article className="flex min-h-full flex-col justify-between rounded-sm border border-border-subtle bg-surface-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-raised">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-neutral">{titleizeCategory(article.category)}</p>
          <p className="text-xs text-text-neutral">{formatPublishedDate(article.published_at)}</p>
        </div>
        <div className="space-y-3">
          <h3 className="text-xl font-semibold leading-tight">{article.title}</h3>
          <p className="text-sm leading-6 text-text-neutral">{article.summary}</p>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link href={`/research/${article.slug}`} className="rounded-sm bg-brand px-3 py-2 text-sm font-medium text-white transition hover:bg-brand/90">
          Read Article
        </Link>
        {article.pdf_url ? (
          <Link href={article.pdf_url} className="rounded-sm border border-border-subtle px-3 py-2 text-sm font-medium transition hover:bg-surface-panel">
            Download PDF
          </Link>
        ) : null}
      </div>
    </article>
  );
}

export default function ResearchPage() {
  const sectionIds = ["hero", "video-library", "reports", "cta"];
  const library = listResearchLibrary();
  const videos = listPublishedVideos().map((v) => ({ ...v, thumbnail: resolveYouTubeThumbnail(v.youtube_url, v.thumbnail_override_url) }));
  return <PublicShell><main className="relative"><ScrollspyRail sectionIds={sectionIds} />
    <section id="hero" className="bg-brand px-6 py-20 text-white"><div className="container-shell space-y-6"><p className="text-xs font-semibold uppercase tracking-[0.16em]">Research & Education</p><h1 className="max-w-3xl text-4xl font-semibold">Learn to validate strategies like a professional.</h1><p className="max-w-3xl text-lg text-white/90">Execution-aware backtesting, robustness diagnostics, and research workflows for traders who want evidence before deployment.</p><div className="flex flex-wrap gap-3"><a href="#video-library" className="rounded-sm bg-white px-4 py-2 text-sm font-medium text-brand">Browse Video Library</a><a href="#reports" className="rounded-sm border border-white/50 px-4 py-2 text-sm">View Research Reports</a><Link href="/contact" className="rounded-sm border border-white/50 px-4 py-2 text-sm">Request Validation Audit</Link></div></div></section>
    <section id="video-library" className="container-shell space-y-6 py-section-sm"><SectionHeader title="Video Library" description="Structured walkthroughs on execution-aware strategy validation, research methodology, and diagnostic workflows." /><ResearchVideoLibrary videos={videos} /></section>
    <section id="reports" className="container-shell space-y-6 py-section-sm"><SectionHeader title="Research Reports" description="Long-form validation frameworks, methodology documents, and structured research publications." /><div className="grid gap-6 md:grid-cols-2">{library.collection.length>0?library.collection.map((article)=><ResearchReportCard key={article.id} article={article} />):<div className="rounded-sm border border-border-subtle bg-surface-panel/40 p-5 md:col-span-2"><p className="text-sm text-text-neutral">Published research reports will appear here.</p></div>}</div></section>
    <section id="cta" className="container-shell py-section-md"><CtaBanner title="Need deeper validation before deployment?" description="For full-spectrum strategy review — including execution stress, regime diagnostics, parameter stability, and capital-risk interpretation — request an independent validation audit." primary={{ label: "Request Validation Audit", href: "/contact" }} /></section>
  </main></PublicShell>;
}
