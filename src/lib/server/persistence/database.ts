import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import { migrations } from "@/lib/server/persistence/migrations";

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
  if (db) return db;
  ensureDbDir();
  db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA journal_mode = WAL;");
  applyMigrations(db);
  return db;
}

export function closeDbForTests() {
  if (db) {
    db.close();
    db = undefined;
  }
}
