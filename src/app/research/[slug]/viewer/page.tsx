import { notFound } from "next/navigation";
import { PublicShell } from "@/components/public/public-shell";
import { getPublicationBySlug } from "@/lib/server/publications/repository";

export default async function PublicationViewerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const publication = getPublicationBySlug(slug);
  if (!publication || publication.status !== "published") notFound();

  return (
    <PublicShell>
      <main className="container-shell py-section-md">
        <section className="rounded-sm border border-border-subtle bg-surface-white p-3">
          <h1 className="mb-3 text-lg font-semibold">Viewer · {publication.title}</h1>
          <iframe title={`${publication.title} viewer`} src={publication.pdf_url} className="h-[75vh] w-full rounded-sm border" />
        </section>
      </main>
    </PublicShell>
  );
}
