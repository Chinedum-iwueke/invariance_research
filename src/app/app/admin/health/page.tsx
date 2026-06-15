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
        <AdminStatCard label="Queued jobs" value={String(snapshot.jobs.queued)} />
        <AdminStatCard label="Running jobs" value={String(snapshot.jobs.processing)} />
        <AdminStatCard label="Failed jobs" value={String(snapshot.jobs.failed)} />
        <AdminStatCard label="Dead-letter jobs" value={String((snapshot.jobs as { dead_letter?: number }).dead_letter ?? 0)} />
        <AdminStatCard label="Overdue processing" value={String((snapshot.jobs as { overdue_processing?: number }).overdue_processing ?? 0)} />
        <AdminStatCard label="Rate-limit events (1h)" value={String(snapshot.rate_limit_events_last_hour)} />
        <AdminStatCard label="Benchmark cache" value={snapshot.benchmark_manifest_cache.cached ? "warm" : "cold"} />
      </div>
      <div className="rounded-sm border border-border-subtle bg-surface-panel/40 p-3 text-xs text-text-neutral">
        <p className="font-semibold text-text-institutional">Operation controls</p>
        <p className="mt-1">
          Analysis queue: {snapshot.operation_controls.analysis_queue_paused ? "paused" : "accepting"} · Export queue: {snapshot.operation_controls.export_queue_paused ? "paused" : "accepting"} · Experiment queue: {snapshot.operation_controls.experiment_queue_paused ? "paused" : "accepting"} · Assistant: {snapshot.operation_controls.assistant_paused ? "paused" : "accepting"}
        </p>
      </div>
      <p className="text-xs text-text-neutral">
        Benchmark provider: {snapshot.benchmark_manifest_cache.provider}
        {snapshot.benchmark_manifest_cache.source ? ` (${snapshot.benchmark_manifest_cache.source})` : ""}
      </p>
      <p className="text-xs text-text-neutral">Last checked: {snapshot.timestamp}</p>
      <div className="grid gap-3 md:grid-cols-2">
        {snapshot.checks.map((check) => <HealthStatusCard key={check.name} name={check.name} status={check.status} detail={check.detail} />)}
      </div>
    </AdminPageShell>
  );
}
