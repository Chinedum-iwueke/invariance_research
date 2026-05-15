import type { ReactNode } from "react";
import Link from "next/link";
import type { PublicationRecord } from "@/lib/publications/model";
import type {
  PublicationArticleBlock,
  PublicationArticleContent,
  PublicationArticleSection,
  PublicationCalloutBlock,
  PublicationFigureBlock as PublicationFigureBlockModel,
} from "@/lib/publications/content";
import { PublicationCopyLinkButton } from "@/components/public/publication-article-actions";
import { PublicationTOC } from "@/components/public/publication-toc";

function formatPublicationDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function titleizeCategory(value: PublicationRecord["category"]) {
  if (value === "research_standard") return "Research Standards";
  return value.replaceAll("_", " ");
}

type PublicationArticleProps = {
  publication: PublicationRecord;
  content: PublicationArticleContent;
  showBackToLibrary?: boolean;
};

type PublicationArticleShellProps = {
  children: ReactNode;
  rail?: ReactNode;
};

function PublicationArticleShell({ children, rail }: PublicationArticleShellProps) {
  return (
    <article className="mx-auto w-full max-w-[1280px] px-[var(--container-inline-padding)] py-section-sm md:py-section-md lg:grid lg:grid-cols-[minmax(0,760px)_240px] lg:gap-14">
      <div>{children}</div>
      <aside className="mt-10 lg:mt-0">{rail}</aside>
    </article>
  );
}

type PublicationMetaBarProps = {
  publication: PublicationRecord;
};

function PublicationMetaBar({ publication }: PublicationMetaBarProps) {
  const published = formatPublicationDate(publication.published_at);
  const updated = formatPublicationDate(publication.updated_at);

  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-text-neutral">
      {published ? <span>Published {published}</span> : null}
      {updated && updated !== published ? <span>Updated {updated}</span> : null}
      {publication.author_label ? <span>{publication.author_label}</span> : null}
      {publication.estimated_read_time ? <span>{publication.estimated_read_time} read</span> : null}
    </div>
  );
}

type PublicationFigureBlockProps = {
  block: PublicationFigureBlockModel;
};

function PublicationFigureBlock({ block }: PublicationFigureBlockProps) {
  return (
    <figure className="my-9 space-y-4 border-y border-border-subtle py-6 md:my-12 md:py-7">
      {block.label ? <p className="font-provenance text-[0.68rem] uppercase tracking-[0.16em] text-brand">{block.label}</p> : null}
      <figcaption className="font-display text-2xl font-medium leading-tight text-text-institutional">{block.title}</figcaption>
      <div className="rounded-md border border-border-subtle bg-surface-panel/40 p-4 md:p-5">
        <p className="text-sm leading-7 text-text-graphite">{block.media}</p>
      </div>
      {block.note ? <p className="text-sm leading-7 text-text-neutral">{block.note}</p> : null}
    </figure>
  );
}

type PublicationCalloutProps = {
  block: PublicationCalloutBlock;
};

function PublicationCallout({ block }: PublicationCalloutProps) {
  return (
    <aside className="my-8 border-l-2 border-brand bg-brand/5 px-4 py-4 md:my-10 md:px-5">
      <p className="text-sm leading-7 text-text-graphite md:text-base">{block.text}</p>
    </aside>
  );
}

type PublicationFooterActionsProps = {
  pdfUrl: string;
};

function PublicationFooterActions({ pdfUrl }: PublicationFooterActionsProps) {
  return (
    <footer className="mt-16 border-t border-border-subtle pt-8">
      <div className="mobile-cta-row">
        <Link href={pdfUrl} className="inline-flex rounded-sm border border-border-subtle px-4 py-2 text-center text-sm font-medium transition hover:bg-surface-panel">
          Download PDF
        </Link>
        <Link href="/research" className="inline-flex rounded-sm border border-border-subtle px-4 py-2 text-center text-sm font-medium text-text-neutral transition hover:bg-surface-panel hover:text-text-institutional">
          Back to Research Library
        </Link>
      </div>
    </footer>
  );
}

function renderSectionBlock(block: PublicationArticleBlock) {
  if (block.type === "paragraph") {
    return <p className="text-[0.98rem] leading-8 text-text-graphite md:text-[1.04rem]">{block.text}</p>;
  }
  if (block.type === "callout") {
    return <PublicationCallout block={block} />;
  }
  if (block.type === "figure") {
    return <PublicationFigureBlock block={block} />;
  }
  return null;
}

function renderSectionHeading(section: PublicationArticleSection) {
  if (section.level === 3) {
    return <h3 className="text-xl font-semibold leading-tight md:text-2xl">{section.title}</h3>;
  }
  return <h2 className="font-display text-[2rem] font-medium leading-none md:text-[2.75rem]">{section.title}</h2>;
}

export function PublicationArticle({ publication, content, showBackToLibrary = true }: PublicationArticleProps) {
  return (
    <PublicationArticleShell
      rail={
        <div className="hidden lg:block lg:sticky lg:top-24">
          <PublicationTOC items={content.sections.map((section) => ({ id: section.id, title: section.title }))} />
        </div>
      }
    >
      <div className="space-y-8">
        {showBackToLibrary ? (
          <Link href="/research" className="inline-flex text-sm font-medium text-text-neutral transition hover:text-text-institutional">
            ← Back to Research Library
          </Link>
        ) : null}

        <header className="public-hero-band -mx-[var(--container-inline-padding)] border-b border-border-subtle px-[var(--container-inline-padding)] py-section-sm md:py-section-md">
          <div className="space-y-5">
          <p className="eyebrow text-brand">{titleizeCategory(publication.category)}</p>
          <h1 className="font-display max-w-[20ch] text-[clamp(2.55rem,12vw,4.2rem)] font-medium leading-[0.96] md:text-[clamp(4rem,6.4vw,5.6rem)]">{publication.title}</h1>
          <p className="max-w-[68ch] text-base leading-8 text-text-neutral md:text-lg">{publication.summary}</p>
          <PublicationMetaBar publication={publication} />
          <div className="mobile-cta-row">
            <Link href={publication.pdf_url} className="inline-flex rounded-sm border border-border-subtle px-4 py-2 text-center text-sm font-medium transition hover:bg-surface-panel">
              Download PDF
            </Link>
            <PublicationCopyLinkButton className="inline-flex rounded-sm border border-border-subtle px-4 py-2 text-center text-sm font-medium text-text-neutral transition hover:bg-surface-panel hover:text-text-institutional" />
          </div>
          </div>
        </header>

        <div className="pt-8">
          <div className="mb-8 h-px w-full bg-border-subtle" />
          <details className="lg:hidden rounded-sm border border-border-subtle px-4 py-3">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.14em] text-text-neutral">Section navigation</summary>
            <ul className="mt-3 space-y-2 text-sm text-text-neutral">
              {content.sections.map((section) => (
                <li key={`mobile-${section.id}`}>
                  <a href={`#${section.id}`} className="transition hover:text-text-institutional">{section.title}</a>
                </li>
              ))}
            </ul>
          </details>

          <div className="space-y-12">
            {content.sections.map((section) => (
              <section key={section.id} id={section.id} className="scroll-mt-24 space-y-5">
                {renderSectionHeading(section)}
                <div className="space-y-5">{section.blocks.map((block, index) => <div key={`${section.id}-${index}`}>{renderSectionBlock(block)}</div>)}</div>
              </section>
            ))}
          </div>
        </div>

        <PublicationFooterActions pdfUrl={publication.pdf_url} />
      </div>
    </PublicationArticleShell>
  );
}

export {
  PublicationArticleShell,
  PublicationMetaBar,
  PublicationTOC,
  PublicationFigureBlock,
  PublicationCallout,
  PublicationFooterActions,
};
