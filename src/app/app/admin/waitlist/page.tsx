import Link from "next/link";
import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { WaitlistAdminTable } from "@/components/admin/waitlist-admin-table";
import { isValidWaitlistStatus, listWaitlistEntries } from "@/lib/server/waitlist/repository";

const STATUSES = ["new", "contacted", "invited", "archived"] as const;

export default async function AdminWaitlistPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const params = await searchParams;
  const status = params.status && isValidWaitlistStatus(params.status) ? params.status : undefined;
  const entries = listWaitlistEntries(status);

  return (
    <AdminPageShell title="Research Desk Waitlist" description="Manage early-access interest, outreach state, and invitation readiness.">
      <AdminFilterBar>
        <Link href="/app/admin/waitlist" className="text-xs underline">
          All
        </Link>
        {STATUSES.map((value) => (
          <Link key={value} href={`/app/admin/waitlist?status=${value}`} className="text-xs underline">
            {value}
          </Link>
        ))}
        <a href={`/api/admin/waitlist/export${status ? `?status=${status}` : ""}`} className="text-xs underline">
          Export CSV
        </a>
      </AdminFilterBar>
      <p className="text-xs text-text-neutral">{entries.length} entries</p>
      <WaitlistAdminTable entries={entries} />
    </AdminPageShell>
  );
}
