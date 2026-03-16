import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { MaintenanceActionCard } from "@/components/admin/maintenance-action-card";
import { requireAdminSession } from "@/lib/server/admin/guards";
import { runAdminMaintenanceAction } from "@/lib/server/admin/maintenance-service";

async function runSweep() {
  "use server";
  await requireAdminSession();
  runAdminMaintenanceAction("sweep");
}

async function runExpiredCleanup() {
  "use server";
  await requireAdminSession();
  runAdminMaintenanceAction("expired_exports");
}

async function runStaleJobsCleanup() {
  "use server";
  await requireAdminSession();
  runAdminMaintenanceAction("stale_failed_jobs");
}

export default function AdminMaintenancePage() {
  return (
    <AdminPageShell title="Maintenance Controls" description="Run bounded maintenance primitives with explicit confirmation.">
      <div className="grid gap-3 md:grid-cols-2">
        <MaintenanceActionCard title="Run full maintenance sweep" description="Runs expired export cleanup and stale failed jobs cleanup." actionLabel="Run sweep" action={runSweep} />
        <MaintenanceActionCard title="Clean expired exports" description="Deletes expired export records and related storage artifacts." actionLabel="Clean exports" action={runExpiredCleanup} />
        <MaintenanceActionCard title="Clean stale failed jobs" description="Deletes failed analysis/export jobs older than retention threshold." actionLabel="Clean stale jobs" action={runStaleJobsCleanup} />
      </div>
    </AdminPageShell>
  );
}
