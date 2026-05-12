import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import { migrations } from "@/lib/server/persistence/migrations";
export { getDatabaseProvider } from "@/lib/server/persistence/provider";
import { getDatabaseProvider } from "@/lib/server/persistence/provider";

const DB_PATH = process.env.INVARIANCE_DB_PATH ?? path.join(process.cwd(), ".data", "invariance.sqlite");

let db: DatabaseSync | undefined;

function ensureDbDir() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

function applyMigrations(connection: DatabaseSync) {
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
