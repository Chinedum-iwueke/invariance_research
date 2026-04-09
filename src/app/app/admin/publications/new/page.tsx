import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { PublicationForm } from "@/components/admin/publication-form";

export default function NewPublicationPage() {
  return (
    <AdminPageShell title="Create publication" description="Upload PDF + cover, set category and publication status.">
      <PublicationForm action="/api/admin/publications" submitLabel="Create publication" />
    </AdminPageShell>
  );
}
