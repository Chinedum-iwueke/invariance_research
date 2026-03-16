const EMBEDDED_WORKERS_DEFAULT = "true";
const ANALYSIS_POLL_MS_DEFAULT = "1500";
const EXPORT_POLL_MS_DEFAULT = "2000";
const WORKER_STALE_MS_DEFAULT = "120000";

function parseBool(value: string | undefined, fallback: string): boolean {
  const normalized = (value ?? fallback).trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function parseMs(value: string | undefined, fallback: string): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) return Number(fallback);
  return Math.floor(parsed);
}

export function shouldRunEmbeddedWorkers() {
  return parseBool(process.env.INVARIANCE_EMBEDDED_WORKERS, EMBEDDED_WORKERS_DEFAULT);
}

export function getWorkerPollIntervalMs(kind: "analysis" | "export") {
  if (kind === "analysis") return parseMs(process.env.INVARIANCE_ANALYSIS_WORKER_POLL_MS, ANALYSIS_POLL_MS_DEFAULT);
  return parseMs(process.env.INVARIANCE_EXPORT_WORKER_POLL_MS, EXPORT_POLL_MS_DEFAULT);
}

export function getWorkerHeartbeatStaleMs() {
  return parseMs(process.env.INVARIANCE_WORKER_STALE_MS, WORKER_STALE_MS_DEFAULT);
}
