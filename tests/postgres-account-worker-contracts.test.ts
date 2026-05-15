import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "invariance-postgres-contracts-"));
process.env.INVARIANCE_DB_PATH = path.join(tempDir, "test.sqlite");
process.env.DATABASE_PROVIDER = "sqlite";
process.env.ANALYSIS_QUEUE_PROVIDER = "db";
process.env.OBJECT_STORAGE_PROVIDER = "local";
process.env.INVARIANCE_STORAGE_ROOT = path.join(tempDir, "storage");
process.env.WORKER_MODE = "external";

import { accountService } from "../src/lib/server/accounts/service";
import { hashPassword } from "../src/lib/server/auth/passwords";
import { createAnalysisFromArtifact } from "../src/lib/server/services/analysis-service";
import { getCoreRepositories } from "../src/lib/server/persistence/repositories";
import { closeDbForTests, getDb } from "../src/lib/server/persistence/database";
import { getAnalysisQueue, resetAnalysisQueueForTests } from "../src/lib/server/queue/provider";

function resetDb() {
  getDb().exec(`
    DELETE FROM export_jobs;
    DELETE FROM exports;
    DELETE FROM webhook_events;
    DELETE FROM analysis_jobs;
    DELETE FROM analyses;
    DELETE FROM artifacts;
    DELETE FROM usage_snapshots;
    DELETE FROM entitlement_snapshots;
    DELETE FROM subscriptions;
    DELETE FROM admin_audit_log;
    DELETE FROM user_roles;
    DELETE FROM auth_tokens;
    DELETE FROM accounts;
    DELETE FROM users;
  `);
}

function seedArtifact(accountId: string, userId: string, artifactId: string) {
  return getCoreRepositories().artifacts.save({
    artifact_id: artifactId,
    owner_user_id: userId,
    account_id: accountId,
    file_name: "trades.csv",
    file_type: "text/csv",
    file_size_bytes: 120,
    storage_key: `uploads/${accountId}/${artifactId}/trades.csv`,
    checksum_sha256: "checksum",
    artifact_kind: "trade_csv",
    richness: "trade_only",
    uploaded_at: "2026-01-01T00:00:00.000Z",
    parsed_artifact: {
      artifact_id: artifactId,
      artifact_type: "generic_trade_csv",
      artifact_kind: "trade_csv",
      richness: "trade_only",
      parser_notes: [],
      trades: [],
      validation: { valid: true, errors: [] },
    } as any,
    eligibility_summary: {
      accepted: true,
      parser_notes: [],
      validation_errors: [],
      diagnostics_available: ["overview"],
      diagnostics_limited: [],
      diagnostics_unavailable: [],
      limitation_reasons: [],
      summary_text: "ok",
      detected_artifact_type: "generic_trade_csv",
      detected_richness: "trade_only",
    } as any,
  });
}

test.beforeEach(() => {
  resetAnalysisQueueForTests();
  resetDb();
});

test.after(() => {
  closeDbForTests();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("signup provisions a free active account with entitlement and usage defaults", async () => {
  const { user, account } = await accountService.createUserAndAccountWithPassword({
    email: "new-postgres-user@example.com",
    name: "New User",
    password: "StrongPass123",
  });

  const repositories = getCoreRepositories();
  assert.equal((await repositories.users.findById(user.user_id))?.email, "new-postgres-user@example.com");
  assert.equal((await repositories.accounts.findByOwnerUserId(user.user_id))?.account_id, account.account_id);
  assert.equal(account.plan_id, "explorer");
  assert.equal(account.subscription_status, "active");
  assert.equal((await repositories.entitlements.get(account.account_id)).plan_id, "explorer");

  const usage = await accountService.getUsage(account.account_id);
  assert.equal(usage.analyses_created, 0);
  assert.equal(usage.artifacts_uploaded, 0);
  assert.equal(usage.report_exports, 0);
});

test("newly provisioned user can create an analysis with a valid account_id", async () => {
  const { user, account } = await accountService.createUserAndAccountWithPassword({
    email: "analysis-user@example.com",
    password: "StrongPass123",
  });
  const artifact = await seedArtifact(account.account_id, user.user_id, "artifact-new-user");

  const created = await createAnalysisFromArtifact({
    artifact_id: artifact.artifact_id,
    owner_user_id: user.user_id,
    account_id: account.account_id,
  });

  const analysis = await getCoreRepositories().analyses.findById(created.analysis_id);
  assert.equal(analysis?.account_id, account.account_id);
  assert.equal(analysis?.owner_user_id, user.user_id);
  assert.equal(analysis?.status, "queued");
  assert.equal((await getAnalysisQueue().getJobStatus(created.job.job_id))?.status, "queued");
});

test("password login repairs a missing account row idempotently", async () => {
  const repositories = getCoreRepositories();
  const user = await repositories.users.save({
    email: "repair-user@example.com",
    password_hash: hashPassword("StrongPass123"),
  });

  assert.equal(await repositories.accounts.findByOwnerUserId(user.user_id), undefined);
  const first = await accountService.authenticateWithPassword({ email: user.email, password: "StrongPass123" });
  const second = await accountService.authenticateWithPassword({ email: user.email, password: "StrongPass123" });

  assert.ok(first?.account.account_id);
  assert.equal(second?.account.account_id, first?.account.account_id);
  assert.equal(first?.account.plan_id, "explorer");
  assert.equal(first?.account.subscription_status, "active");
});

test("analysis worker db queue uses provider repositories instead of SQLite-only job repository", () => {
  const dbQueueSource = fs.readFileSync(path.join(process.cwd(), "src/lib/server/queue/db-analysis-queue.ts"), "utf8");
  const workerSource = fs.readFileSync(path.join(process.cwd(), "src/lib/server/workers/analysis-worker.ts"), "utf8");
  const runtimeSource = fs.readFileSync(path.join(process.cwd(), "src/lib/server/workers/worker-runtime.ts"), "utf8");
  const postgresHeartbeatSource = fs.readFileSync(path.join(process.cwd(), "src/lib/server/repositories/postgres-worker-heartbeat-repository.ts"), "utf8");

  assert.equal(dbQueueSource.includes("jobRepository"), false);
  assert.equal(dbQueueSource.includes("getCoreRepositories"), true);
  assert.equal(workerSource.includes("getDb("), false);
  assert.equal(runtimeSource.includes("getDb("), false);
  assert.equal(postgresHeartbeatSource.includes("CREATE TABLE IF NOT EXISTS worker_heartbeats"), true);
});
