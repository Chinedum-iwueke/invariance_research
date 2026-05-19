import { createRequire } from "node:module";
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

function loadPgPoolConstructor(): new (config: { connectionString: string }) => PgPool {
  const require = createRequire(import.meta.url);
  try {
    return require("pg").Pool;
  } catch {
    throw new Error("DATABASE_PROVIDER=postgres requires the optional 'pg' package. Install it before running Supabase/Postgres mode.");
  }
}

function getRawPostgresPool(): PgPool {
  if (rawPool) return rawPool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required when DATABASE_PROVIDER=postgres.");
  const Pool = loadPgPoolConstructor();
  rawPool = new Pool({ connectionString });
  return rawPool;
}

export async function ensurePostgresSchema(): Promise<void> {
  if (process.env.POSTGRES_SCHEMA_AUTO_INIT === "false") return;
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
