import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
import { migrations } from "@/lib/server/persistence/migrations";
export { getDatabaseProvider } from "@/lib/server/persistence/provider";
import { getDatabaseProvider } from "@/lib/server/persistence/provider";

const DB_PATH = process.env.INVARIANCE_DB_PATH ?? path.join(process.cwd(), ".data", "invariance.sqlite");

type SqliteRow = Record<string, unknown>;
type SqliteRunResult = {
  changes?: number;
  lastInsertRowid?: number | bigint;
};

type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): {
    get(...params: unknown[]): SqliteRow | undefined;
    run(...params: unknown[]): SqliteRunResult;
    all(...params: unknown[]): SqliteRow[];
  };
  close(): void;
};

type DatabaseSyncConstructor = new (path: string, options?: Record<string, unknown>) => SqliteDatabase;

let db: SqliteDatabase | undefined;

let DatabaseSync: DatabaseSyncConstructor | undefined;

function getDatabaseSyncConstructor(): DatabaseSyncConstructor {
  if (DatabaseSync) return DatabaseSync;
  const require = createRequire(import.meta.url);
  try {
    // node:sqlite is unavailable in the Node 20 worker image and should only be
    // loaded for local SQLite mode, never for DATABASE_PROVIDER=postgres.
    const originalEmitWarning = process.emitWarning;
    let sqliteModule: { DatabaseSync: DatabaseSyncConstructor };
    try {
      process.emitWarning = ((warning: string | Error, ...args: unknown[]) => {
        const warningText = typeof warning === "string" ? warning : warning.message;
        const type = typeof args[0] === "string"
          ? args[0]
          : args[0] && typeof args[0] === "object" && "type" in args[0]
            ? String((args[0] as { type?: unknown }).type)
            : undefined;
        if (type === "ExperimentalWarning" && /SQLite/i.test(warningText)) return;
        return originalEmitWarning.call(process, warning as string, ...(args as []));
      }) as typeof process.emitWarning;
      sqliteModule = require("node:sqlite") as { DatabaseSync: DatabaseSyncConstructor };
    } finally {
      process.emitWarning = originalEmitWarning;
    }
    DatabaseSync = sqliteModule.DatabaseSync;
    return DatabaseSync;
  } catch (error) {
    const message = error instanceof Error ? error.message : "node_sqlite_unavailable";
    throw new Error(`SQLite runtime unavailable. Use DATABASE_PROVIDER=postgres or run on a Node version with node:sqlite. ${message}`);
  }
}

function ensureDbDir() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

function applyMigrations(connection: SqliteDatabase) {
  connection.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);

  for (const migration of migrations) {
    const existing = connection
      .prepare("SELECT version FROM schema_migrations WHERE version = ?")
      .get(migration.version) as { version?: number } | undefined;
    if (existing?.version) continue;
    connection.exec("BEGIN");
    try {
      connection.exec(migration.sql);
      connection
        .prepare("INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)")
        .run(migration.version, migration.name, new Date().toISOString());
      connection.exec("COMMIT");
    } catch (error) {
      connection.exec("ROLLBACK");
      throw error;
    }
  }
}

export function getDb() {
  if (getDatabaseProvider() === "postgres") {
    throw new Error("SQLite getDb() was called while DATABASE_PROVIDER=postgres. Use repository/provider contracts instead.");
  }
  if (db) return db;
  ensureDbDir();
  const DatabaseSync = getDatabaseSyncConstructor();
  db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA journal_mode = WAL;");
  applyMigrations(db);
  return db;
}

export const sqliteTransactionRunner = {
  withTransaction<T>(fn: () => T): T {
    const connection = getDb();
    connection.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      connection.exec("COMMIT");
      return result;
    } catch (error) {
      connection.exec("ROLLBACK");
      throw error;
    }
  },
};

export function closeDbForTests() {
  if (db) {
    db.close();
    db = undefined;
  }
}
