import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { postgresSchemaSql } from "@/lib/server/persistence/postgres-schema";

type PgPool = {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }>;
  connect(): Promise<PgClient>;
  end(): Promise<void>;
};

type PgClient = {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }>;
  release(): void;
};

let pool: PgPool | undefined;
let rawPool: PgPool | undefined;
let schemaReady: Promise<void> | undefined;

type PgPoolConfig = {
  connectionString: string;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  allowExitOnIdle?: boolean;
};

function loadPgPoolConstructor(): new (config: PgPoolConfig) => PgPool {
  const require = createRequire(import.meta.url);
  try {
    return require("pg").Pool;
  } catch {
    throw new Error("DATABASE_PROVIDER=postgres requires the optional 'pg' package. Install it before running Supabase/Postgres mode.");
  }
}

function readPositiveIntegerEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getDefaultPoolMax(): number {
  if (process.env.POSTGRES_POOL_MAX) return readPositiveIntegerEnv("POSTGRES_POOL_MAX", 1);
  return process.env.VERCEL || process.env.NODE_ENV === "production" ? 1 : 5;
}

function getRawPostgresPool(): PgPool {
  if (rawPool) return rawPool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required when DATABASE_PROVIDER=postgres.");
  const Pool = loadPgPoolConstructor();
  rawPool = new Pool({
    connectionString,
    max: getDefaultPoolMax(),
    idleTimeoutMillis: readPositiveIntegerEnv("POSTGRES_IDLE_TIMEOUT_MS", 10_000),
    connectionTimeoutMillis: readPositiveIntegerEnv("POSTGRES_CONNECTION_TIMEOUT_MS", 5_000),
    allowExitOnIdle: true,
  });
  return rawPool;
}

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

export function getPostgresRuntimeDiagnostics(env: NodeJS.ProcessEnv = process.env) {
  const raw = env.DATABASE_URL;
  if (!raw) {
    return {
      present: false,
      parseable: false,
    };
  }

  try {
    const url = new URL(raw);
    return {
      present: true,
      parseable: true,
      hash: hashValue(raw),
      protocol: url.protocol.replace(":", ""),
      username: decodeURIComponent(url.username),
      host: url.hostname,
      port: url.port || null,
      database: url.pathname.replace(/^\//, "") || null,
      sslmode: url.searchParams.get("sslmode"),
      uselibpqcompat: url.searchParams.get("uselibpqcompat"),
      has_password: url.password.length > 0,
    };
  } catch (error) {
    return {
      present: true,
      parseable: false,
      hash: hashValue(raw),
      error: error instanceof Error ? error.message : "database_url_parse_failed",
    };
  }
}

export async function ensurePostgresSchema(): Promise<void> {
  const autoInit = (process.env.POSTGRES_SCHEMA_AUTO_INIT ?? (process.env.VERCEL || process.env.NODE_ENV === "production" ? "false" : "true")).trim().toLowerCase();
  if (autoInit !== "true") return;
  if (schemaReady) return schemaReady;

  schemaReady = getRawPostgresPool()
    .query(postgresSchemaSql)
    .then(() => undefined)
    .catch((error) => {
      schemaReady = undefined;
      throw error;
    });

  return schemaReady;
}

export function getPostgresPool(): PgPool {
  if (pool) return pool;
  const raw = getRawPostgresPool();
  pool = {
    async query<T = Record<string, unknown>>(sql: string, params?: unknown[]) {
      await ensurePostgresSchema();
      return raw.query<T>(sql, params);
    },
    async connect() {
      await ensurePostgresSchema();
      return raw.connect();
    },
    async end() {
      await raw.end();
    },
  };
  return pool;
}

export async function withPostgresTransaction<T>(fn: (client: PgClient) => Promise<T>): Promise<T> {
  const client = await getPostgresPool().connect();
  await client.query("BEGIN");
  try {
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function closePostgresForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
    rawPool = undefined;
    schemaReady = undefined;
  } else if (rawPool) {
    await rawPool.end();
    rawPool = undefined;
    schemaReady = undefined;
  }
}
