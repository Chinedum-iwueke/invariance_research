import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

test("SQLite to Postgres migration supports dry-run without Postgres writes", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "invariance-migration-dry-run-"));
  const sqlitePath = path.join(tempDir, "source.sqlite");
  const db = new DatabaseSync(sqlitePath);
  db.exec(`
    CREATE TABLE users (
      user_id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      name TEXT,
      created_at TEXT NOT NULL,
      last_login_at TEXT NOT NULL,
      password_hash TEXT,
      password_updated_at TEXT
    );
    INSERT INTO users (user_id, email, name, created_at, last_login_at)
    VALUES ('user-1', 'dry-run@example.com', NULL, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
  `);
  db.close();

  const result = spawnSync("npx", ["tsx", "scripts/migrate-sqlite-to-postgres.ts", `--sqlite=${sqlitePath}`, "--dry-run"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, DATABASE_URL: "" },
  });

  fs.rmSync(tempDir, { recursive: true, force: true });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /users/);
  assert.match(result.stdout, /Dry run only/);
});
