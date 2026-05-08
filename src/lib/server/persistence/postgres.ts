import { createRequire } from "node:module";

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

function loadPgPoolConstructor(): new (config: { connectionString: string }) => PgPool {
  const require = createRequire(import.meta.url);
  try {
    return require("pg").Pool;
  } catch {
    throw new Error("DATABASE_PROVIDER=postgres requires the optional 'pg' package. Install it before running Supabase/Postgres mode.");
  }
}

export function getPostgresPool(): PgPool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required when DATABASE_PROVIDER=postgres.");
  const Pool = loadPgPoolConstructor();
  pool = new Pool({ connectionString });
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
  }
}
