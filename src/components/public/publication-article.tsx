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
    <article className="mx-auto w-full max-w-[1280px] px-6 py-section-md lg:grid lg:grid-cols-[minmax(0,760px)_240px] lg:gap-14">
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
    <figure className="my-12 space-y-4 border-y border-border-subtle py-7">
      {block.label ? <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-text-neutral">{block.label}</p> : null}
      <figcaption className="text-lg font-semibold leading-tight text-text-institutional">{block.title}</figcaption>
      <div className="rounded-md border border-border-subtle bg-surface-panel/40 p-5">
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
    <aside className="my-10 border-l-2 border-brand bg-surface-panel/35 px-5 py-4">
      <p className="text-base leading-7 text-text-graphite">{block.text}</p>
    </aside>
  );
}

type PublicationFooterActionsProps = {
  pdfUrl: string;
};

function PublicationFooterActions({ pdfUrl }: PublicationFooterActionsProps) {
  return (
    <footer className="mt-16 border-t border-border-subtle pt-8">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={pdfUrl} className="inline-flex rounded-sm border border-border-subtle px-4 py-2 text-sm font-medium transition hover:bg-surface-panel">
          Download PDF
        </Link>
        <Link href="/research" className="inline-flex rounded-sm border border-border-subtle px-4 py-2 text-sm font-medium text-text-neutral transition hover:text-text-institutional hover:bg-surface-panel">
          Back to Research Library
        </Link>
      </div>
    </footer>
  );
}

function renderSectionBlock(block: PublicationArticleBlock) {
  if (block.type === "paragraph") {
    return <p className="text-[1.04rem] leading-8 text-text-graphite">{block.text}</p>;
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
  return <h2 className="text-2xl font-semibold leading-tight md:text-[2rem]">{section.title}</h2>;
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

        <header className="space-y-5">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-text-neutral">{titleizeCategory(publication.category)}</p>
          <h1 className="max-w-[20ch] text-4xl font-semibold leading-[1.06] md:text-6xl">{publication.title}</h1>
          <p className="max-w-[68ch] text-lg leading-8 text-text-neutral">{publication.summary}</p>
          <PublicationMetaBar publication={publication} />
          <div className="flex flex-wrap gap-3">
            <Link href={publication.pdf_url} className="inline-flex rounded-sm border border-border-subtle px-4 py-2 text-sm font-medium transition hover:bg-surface-panel">
              Download PDF
            </Link>
            <PublicationCopyLinkButton className="inline-flex rounded-sm border border-border-subtle px-4 py-2 text-sm font-medium text-text-neutral transition hover:text-text-institutional hover:bg-surface-panel" />
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
