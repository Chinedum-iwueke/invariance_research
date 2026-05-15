import { getHealthSnapshot } from "@/lib/server/ops/health-service";
import { getBenchmarkManifestCacheStatus } from "@/lib/benchmarks/benchmark-library";
import { countRecentRateLimitEvents } from "@/lib/server/rate-limits";
import { listAdminJobs } from "@/lib/server/admin/jobs-service";

export async function getAdminHealthSnapshot() {
  const snapshot = await getHealthSnapshot();
  const jobs = await listAdminJobs();
  const rateLimitEventsLastHour = await countRecentRateLimitEvents(60);
  const benchmarkManifestCache = getBenchmarkManifestCacheStatus();
  const engineProbe = snapshot.checks.find((check) => check.name === "engine_probe");
  const queue = snapshot.checks.find((check) => check.name === "queue");
  const analysisWorker = snapshot.checks.find((check) => check.name === "analysis_worker");
  const exportWorker = snapshot.checks.find((check) => check.name === "export_worker");
  return {
    ...snapshot,
    startup_validation_state: snapshot.status,
    engine_version: engineProbe?.detail?.startsWith("version=") ? engineProbe.detail.replace("version=", "") : "unknown",
    queue_backlog: queue?.meta,
    workers: {
      analysis: analysisWorker?.status ?? "degraded",
      export: exportWorker?.status ?? "degraded",
    },
    jobs: jobs.summary,
    rate_limit_events_last_hour: rateLimitEventsLastHour,
    benchmark_manifest_cache: benchmarkManifestCache,
    llm_fallback_failures: "log_only",
  };
}
