import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { HealthStatusCard } from "@/components/admin/health-status-card";
import { getAdminHealthSnapshot } from "@/lib/server/admin/health-service";

export default async function AdminHealthPage() {
  const snapshot = await getAdminHealthSnapshot();

  return (
    <AdminPageShell title="System Health" description="Readiness checks for core platform dependencies.">
      <div className="grid gap-3 md:grid-cols-3">
        <AdminStatCard label="Overall" value={snapshot.status} />
        <AdminStatCard label="Startup validation" value={snapshot.startup_validation_state} />
        <AdminStatCard label="Engine version" value={snapshot.engine_version} />
      </div>
      <p className="text-xs text-text-neutral">Last checked: {snapshot.timestamp}</p>
      <div className="grid gap-3 md:grid-cols-2">
        {snapshot.checks.map((check) => <HealthStatusCard key={check.name} name={check.name} status={check.status} detail={check.detail} />)}
      </div>
    </AdminPageShell>
  );
}
