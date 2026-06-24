import { getHealthSnapshot } from "@/lib/server/ops/health-service";
import { getBenchmarkManifestCacheStatus } from "@/lib/benchmarks/benchmark-library";
import { countRecentRateLimitEvents } from "@/lib/server/rate-limits";
import { listAdminJobs } from "@/lib/server/admin/jobs-service";
import { getOperationControls } from "@/lib/server/ops/operations-policy";
import { getResearchAssistantProviderHealth } from "@/lib/server/llm/chat-provider";
import { researchCopilotRepository } from "@/lib/server/research-copilot/repository";

export async function getAdminHealthSnapshot() {
  const snapshot = await getHealthSnapshot();
  const jobs = await listAdminJobs();
  const rateLimitEventsLastHour = await countRecentRateLimitEvents(60);
  const benchmarkManifestCache = getBenchmarkManifestCacheStatus();
  const engineProbe = snapshot.checks.find((check) => check.name === "engine_probe");
  const queue = snapshot.checks.find((check) => check.name === "queue");
  const analysisWorker = snapshot.checks.find((check) => check.name === "analysis_worker");
  const exportWorker = snapshot.checks.find((check) => check.name === "export_worker");
  const experimentWorker = snapshot.checks.find((check) => check.name === "experiment_worker");
  const executionWorker = snapshot.checks.find((check) => check.name === "execution_worker");
  const copilot = await researchCopilotRepository.getOpsSnapshot().catch(() => ({ turns_24h: 0, failed_turns_24h: 0, ingestion_failures_24h: 0, pending_proposals: 0, failed_tool_calls_24h: 0, prompt_tokens_24h: 0, completion_tokens_24h: 0, average_duration_ms_24h: 0, estimated_cost_usd_24h: 0 }));
  return {
    ...snapshot,
    startup_validation_state: snapshot.status,
    engine_version: engineProbe?.detail?.startsWith("version=") ? engineProbe.detail.replace("version=", "") : "unknown",
    queue_backlog: queue?.meta,
    workers: {
      analysis: analysisWorker?.status ?? "degraded",
      export: exportWorker?.status ?? "degraded",
      experiment: experimentWorker?.status ?? "degraded",
      execution: executionWorker?.status ?? "degraded",
    },
    operation_controls: getOperationControls(),
    jobs: jobs.summary,
    rate_limit_events_last_hour: rateLimitEventsLastHour,
    benchmark_manifest_cache: benchmarkManifestCache,
    llm: getResearchAssistantProviderHealth(),
    copilot,
  };
}
