import Link from "next/link";
import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { ResearchDeskAdminTable } from "@/components/admin/research-desk-admin-table";
import { listResearchDeskQueue } from "@/lib/server/research-desk/research-desk-service";
import { isResearchDeskRequestStatus } from "@/lib/server/research-desk/models";

const STATUSES = ["new", "triaged", "in_review", "addendum_approved", "closed"] as const;

export default async function AdminResearchDeskPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const params = await searchParams;
  const status = params.status && isResearchDeskRequestStatus(params.status) ? params.status : undefined;
  const requests = listResearchDeskQueue(status);

  return (
    <AdminPageShell title="Research Desk Queue" description="Artifact-linked limitation reviews, reviewer addenda, and product-learning promotion gates.">
      <AdminFilterBar>
        <Link href="/app/admin/research-desk" className="text-xs underline">All</Link>
        {STATUSES.map((value) => (
          <Link key={value} href={`/app/admin/research-desk?status=${value}`} className="text-xs underline">
            {value}
          </Link>
        ))}
      </AdminFilterBar>
      <p className="text-xs text-text-neutral">{requests.length} requests</p>
      <ResearchDeskAdminTable requests={requests} />
    </AdminPageShell>
  );
}
