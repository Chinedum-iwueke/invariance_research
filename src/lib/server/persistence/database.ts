import path from "node:path";
import fs from "node:fs";
import { migrations } from "@/lib/server/persistence/migrations";
export { getDatabaseProvider } from "@/lib/server/persistence/provider";
import { getDatabaseProvider } from "@/lib/server/persistence/provider";

const DB_PATH = process.env.INVARIANCE_DB_PATH ?? path.join(process.cwd(), ".data", "invariance.sqlite");

type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): {
    get(...params: unknown[]): any;
    run(...params: unknown[]): any;
    all(...params: unknown[]): any[];
  };
  close(): void;
};

type DatabaseSyncConstructor = new (path: string, options?: Record<string, unknown>) => SqliteDatabase;

let db: SqliteDatabase | undefined;

let DatabaseSync: DatabaseSyncConstructor | undefined;

function getDatabaseSyncConstructor(): DatabaseSyncConstructor {
  if (DatabaseSync) return DatabaseSync;
  try {
    // node:sqlite is unavailable in the Node 20 worker image and should only be
    // loaded for local SQLite mode, never for DATABASE_PROVIDER=postgres.
    const sqliteModule = require("node:sqlite") as { DatabaseSync: DatabaseSyncConstructor };
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
