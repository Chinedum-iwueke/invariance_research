import { notFound } from "next/navigation";
import { PublicShell } from "@/components/public/public-shell";
import { PublicationArticle } from "@/components/public/publication-article";
import { resolvePublicationContent } from "@/lib/publications/content";
import { getPublicationBySlug } from "@/lib/server/publications/repository";

export default async function PublicationDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const publication = getPublicationBySlug(slug);
  if (!publication || publication.status !== "published") notFound();

  return (
    <PublicShell>
      <PublicationArticle publication={publication} content={resolvePublicationContent(publication)} />
    </PublicShell>
  );
}
