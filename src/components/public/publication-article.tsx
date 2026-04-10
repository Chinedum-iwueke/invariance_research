import Link from "next/link";
import type { PublicationRecord } from "@/lib/publications/model";
import type { PublicationArticleContent } from "@/lib/publications/content";

function formatPublicationDate(value: string | null) {
  if (!value) return "Unscheduled";
  return new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

type PublicationArticleProps = {
  publication: PublicationRecord;
  content: PublicationArticleContent;
  showBackToLibrary?: boolean;
};

export function PublicationArticle({ publication, content, showBackToLibrary = true }: PublicationArticleProps) {
  return (
    <article className="container-shell grid gap-8 py-section-md lg:grid-cols-[minmax(0,1fr)_16rem]">
      <div className="space-y-8">
        {showBackToLibrary ? (
          <Link href="/research" className="inline-flex text-sm font-medium text-text-neutral transition hover:text-text-institutional">
            ← Back to research library
          </Link>
        ) : null}

        <header className="space-y-4 border-b border-border-subtle pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-neutral">{publication.category.replaceAll("_", " ")}</p>
          <h1 className="max-w-4xl text-4xl font-semibold leading-tight md:text-5xl">{publication.title}</h1>
          <p className="max-w-3xl text-base leading-relaxed text-text-neutral md:text-lg">{publication.summary}</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-text-neutral">
            <span>Published {formatPublicationDate(publication.published_at)}</span>
            {publication.author_label ? <span>By {publication.author_label}</span> : null}
            {publication.estimated_read_time ? <span>{publication.estimated_read_time} read</span> : null}
          </div>
          <div>
            <Link href={publication.pdf_url} className="inline-flex rounded-sm border border-border-subtle px-4 py-2 text-sm font-medium transition hover:bg-surface-panel">
              Download PDF
            </Link>
          </div>
        </header>

        <div className="space-y-8">
          {content.sections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-24 space-y-3">
              <h2 className="text-2xl font-semibold">{section.title}</h2>
              <div className="space-y-3 text-[0.98rem] leading-7 text-text-graphite">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {content.sections.length > 1 ? (
        <aside className="hidden lg:block">
          <nav className="sticky top-24 rounded-md border border-border-subtle bg-surface-panel/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-neutral">On this page</p>
            <ul className="mt-3 space-y-2 text-sm text-text-neutral">
              {content.sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`} className="transition hover:text-text-institutional">
                    {section.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
      ) : null}
    </article>
  );
}
