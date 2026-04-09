import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicShell } from "@/components/public/public-shell";
import { Card } from "@/components/ui/card";
import { getPublicationBySlug } from "@/lib/server/publications/repository";

export default async function PublicationDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const publication = getPublicationBySlug(slug);
  if (!publication || publication.status !== "published") notFound();

  return (
    <PublicShell>
      <main className="container-shell py-section-md">
        <Card className="space-y-4 p-card-lg">
          <p className="text-xs uppercase tracking-[0.12em] text-text-neutral">{publication.category.replaceAll("_", " ")}</p>
          <h1 className="text-3xl font-semibold">{publication.title}</h1>
          <p className="text-sm text-text-neutral">{publication.summary}</p>
          <p className="text-xs text-text-neutral">Published {publication.published_at?.slice(0, 10) ?? "-"} · Updated {publication.updated_at.slice(0, 10)}</p>
          <div className="flex gap-3 text-sm">
            <Link href={publication.viewer_url} className="rounded-sm border px-4 py-2 hover:bg-surface-panel">Open Viewer</Link>
            <Link href={publication.pdf_url} className="rounded-sm border px-4 py-2 hover:bg-surface-panel">Download PDF</Link>
          </div>
        </Card>
      </main>
    </PublicShell>
  );
}
