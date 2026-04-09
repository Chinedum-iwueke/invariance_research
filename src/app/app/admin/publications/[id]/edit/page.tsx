import { notFound } from "next/navigation";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { PublicationForm } from "@/components/admin/publication-form";
import { getPublicationById } from "@/lib/server/publications/repository";

export default async function EditPublicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const publication = getPublicationById(id);
  if (!publication) notFound();

  return (
    <AdminPageShell title={`Edit: ${publication.title}`} description="Update metadata or replace publication assets.">
      <PublicationForm action={`/api/admin/publications/${id}`} publication={publication} submitLabel="Save changes" />
    </AdminPageShell>
  );
}
