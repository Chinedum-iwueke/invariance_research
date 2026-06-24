const ANALYSIS_POLL_MS_DEFAULT = "1500";
const EXPORT_POLL_MS_DEFAULT = "2000";
const EXPERIMENT_POLL_MS_DEFAULT = "3000";
const EXECUTION_POLL_MS_DEFAULT = "5000";
const WORKER_STALE_MS_DEFAULT = "120000";

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function parseMs(value: string | undefined, fallback: string): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) return Number(fallback);
  return Math.floor(parsed);
}

export function getWorkerMode() {
  const mode = (process.env.WORKER_MODE ?? (process.env.NODE_ENV === "development" ? "embedded" : "external")).trim().toLowerCase();
  if (mode !== "embedded" && mode !== "external") {
    throw new Error(`Unsupported WORKER_MODE "${mode}". Expected embedded or external.`);
  }
  return mode;
}

export function allowEmbeddedWorkers() {
  return parseBool(process.env.ALLOW_EMBEDDED_WORKERS, process.env.NODE_ENV === "development");
}

export function assertWorkerRuntimeConfig() {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const mode = getWorkerMode();
  const allowEmbedded = allowEmbeddedWorkers();

  if (nodeEnv === "production" && (mode === "embedded" || allowEmbedded)) {
    throw new Error("Embedded workers are disabled in production. Use WORKER_MODE=external and ALLOW_EMBEDDED_WORKERS=false.");
  }

  if (nodeEnv !== "development" && mode === "embedded" && !allowEmbedded) {
    throw new Error("Embedded worker mode requires ALLOW_EMBEDDED_WORKERS=true.");
  }

  return { nodeEnv, mode, allowEmbedded };
}

export function shouldRunEmbeddedWorkers() {
  const { nodeEnv, mode, allowEmbedded } = assertWorkerRuntimeConfig();
  return nodeEnv === "development" && mode === "embedded" && allowEmbedded;
}

export function getWorkerPollIntervalMs(kind: "analysis" | "export" | "experiment" | "execution") {
  if (kind === "analysis") return parseMs(process.env.INVARIANCE_ANALYSIS_WORKER_POLL_MS, ANALYSIS_POLL_MS_DEFAULT);
  if (kind === "experiment") return parseMs(process.env.INVARIANCE_EXPERIMENT_WORKER_POLL_MS, EXPERIMENT_POLL_MS_DEFAULT);
  if (kind === "execution") return parseMs(process.env.INVARIANCE_EXECUTION_WORKER_POLL_MS, EXECUTION_POLL_MS_DEFAULT);
  return parseMs(process.env.INVARIANCE_EXPORT_WORKER_POLL_MS, EXPORT_POLL_MS_DEFAULT);
}

export function getWorkerHeartbeatStaleMs() {
  return parseMs(process.env.INVARIANCE_WORKER_STALE_MS, WORKER_STALE_MS_DEFAULT);
}
