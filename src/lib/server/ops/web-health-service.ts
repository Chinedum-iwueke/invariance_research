import { getDatabaseProvider } from "@/lib/server/persistence/provider";
import { getPostgresPool } from "@/lib/server/persistence/postgres";
import { getSqliteRuntimeDb } from "@/lib/server/persistence/sqlite-runtime";
import { assertWorkerRuntimeConfig } from "@/lib/server/queue/runtime-config";
import { logger } from "@/lib/server/ops/logger";
import { getObjectStorage, getObjectStorageProvider } from "@/lib/server/storage/object-storage";

export type WebHealthLevel = "healthy" | "unhealthy";
export type WebReadinessCheck = {
  name: "database" | "schema" | "runtime" | "storage_config";
  status: WebHealthLevel;
  detail: string;
};

type ReadinessDependencies = {
  checkDatabase: () => Promise<void>;
  checkSchema: () => Promise<void>;
  checkRuntime: () => Promise<void>;
  checkStorageConfig: () => Promise<void>;
};

const REQUIRED_SCHEMA_TABLES = ["users", "accounts", "worker_heartbeats", "research_programs"] as const;
let cachedReadiness: { expiresAt: number; snapshot: WebReadinessSnapshot } | undefined;
let inFlightReadiness: Promise<WebReadinessSnapshot> | undefined;

export type WebReadinessSnapshot = {
  ok: boolean;
  status: WebHealthLevel;
  service: "invariance-web";
  timestamp: string;
  release: ReturnType<typeof releaseIdentity>;
  checks: WebReadinessCheck[];
};

function releaseIdentity() {
  return {
    version: process.env.APP_RELEASE_VERSION?.trim() || process.env.npm_package_version || "unknown",
    commit: process.env.APP_GIT_SHA?.trim() || "unknown",
    image: process.env.APP_IMAGE_DIGEST?.trim() || "unknown",
  };
}

export function getLivenessSnapshot() {
  return {
    ok: true,
    status: "healthy" as const,
    service: "invariance-web" as const,
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor(process.uptime()),
    release: releaseIdentity(),
  };
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function withTimeout<T>(name: string, operation: Promise<T>) {
  const timeoutMs = positiveInteger(process.env.WEB_READINESS_TIMEOUT_MS, 4_000);
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${name}_timeout`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function checkDatabase() {
  const provider = getDatabaseProvider();
  if (process.env.NODE_ENV === "production" && provider !== "postgres") {
    throw new Error("production_database_provider_must_be_postgres");
  }

  if (provider === "postgres") {
    await getPostgresPool().query("SELECT 1");
    return;
  }

  getSqliteRuntimeDb().prepare("SELECT 1").get();
}

async function checkSchema() {
  if (getDatabaseProvider() === "postgres") {
    const result = await getPostgresPool().query<{ table_name: string | null }>(
      `SELECT unnest(ARRAY[
        to_regclass('public.users')::text,
        to_regclass('public.accounts')::text,
        to_regclass('public.worker_heartbeats')::text,
        to_regclass('public.research_programs')::text
      ]) AS table_name`,
    );
    if (result.rows.some((row) => row.table_name === null)) throw new Error("required_schema_missing");
    return;
  }

  const placeholders = REQUIRED_SCHEMA_TABLES.map(() => "?").join(",");
  const rows = getSqliteRuntimeDb()
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${placeholders})`)
    .all(...REQUIRED_SCHEMA_TABLES) as Array<{ name: string }>;
  if (rows.length !== REQUIRED_SCHEMA_TABLES.length) throw new Error("required_schema_missing");
}

async function checkRuntime() {
  const worker = assertWorkerRuntimeConfig();
  if (process.env.NODE_ENV !== "production") return;

  if (worker.mode !== "external" || worker.allowEmbedded) throw new Error("production_workers_must_be_external");
  if ((process.env.POSTGRES_SCHEMA_AUTO_INIT ?? "false").trim().toLowerCase() !== "false") {
    throw new Error("production_schema_auto_init_must_be_false");
  }

  const authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  const canonicalUrl = process.env.APP_URL || process.env.AUTH_URL || process.env.NEXTAUTH_URL;
  if (!authSecret || !canonicalUrl) throw new Error("production_auth_configuration_missing");
  new URL(canonicalUrl);
}

async function checkStorageConfig() {
  const provider = getObjectStorageProvider();
  if (process.env.NODE_ENV === "production" && provider === "local") {
    throw new Error("production_object_storage_must_be_remote");
  }
  getObjectStorage();
}

const defaultDependencies: ReadinessDependencies = {
  checkDatabase,
  checkSchema,
  checkRuntime,
  checkStorageConfig,
};

async function runCheck(name: WebReadinessCheck["name"], operation: () => Promise<void>): Promise<WebReadinessCheck> {
  try {
    await withTimeout(name, operation());
    return { name, status: "healthy", detail: "ready" };
  } catch (error) {
    const candidate = error as { name?: unknown; code?: unknown };
    logger.error("web.readiness.check_failed", {
      check: name,
      error_type: typeof candidate?.name === "string" ? candidate.name : "readiness_check_failed",
      error_code: typeof candidate?.code === "string" ? candidate.code : undefined,
    });
    return { name, status: "unhealthy", detail: `${name}_unavailable` };
  }
}

export async function runWebReadinessChecks(
  dependencies: ReadinessDependencies = defaultDependencies,
): Promise<WebReadinessSnapshot> {
  const checks = await Promise.all([
    runCheck("database", dependencies.checkDatabase),
    runCheck("schema", dependencies.checkSchema),
    runCheck("runtime", dependencies.checkRuntime),
    runCheck("storage_config", dependencies.checkStorageConfig),
  ]);
  const ok = checks.every((check) => check.status === "healthy");
  return {
    ok,
    status: ok ? "healthy" : "unhealthy",
    service: "invariance-web",
    timestamp: new Date().toISOString(),
    release: releaseIdentity(),
    checks,
  };
}

export async function getWebReadinessSnapshot() {
  const now = Date.now();
  if (cachedReadiness && cachedReadiness.expiresAt > now) return cachedReadiness.snapshot;
  if (inFlightReadiness) return inFlightReadiness;

  inFlightReadiness = runWebReadinessChecks().then((snapshot) => {
    cachedReadiness = {
      snapshot,
      expiresAt: Date.now() + positiveInteger(process.env.WEB_READINESS_CACHE_TTL_MS, 5_000),
    };
    return snapshot;
  }).finally(() => {
    inFlightReadiness = undefined;
  });
  return inFlightReadiness;
}

export function resetWebReadinessCacheForTests() {
  cachedReadiness = undefined;
  inFlightReadiness = undefined;
}
