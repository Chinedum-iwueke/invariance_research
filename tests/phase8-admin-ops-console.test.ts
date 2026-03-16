import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "invariance-phase8-"));
process.env.INVARIANCE_DB_PATH = path.join(tempDir, "test.sqlite");
process.env.INVARIANCE_STORAGE_ROOT = path.join(tempDir, "storage");
process.env.ADMIN_EMAILS = "admin@example.com";
process.env.ADMIN_USER_IDS = "admin-user-1";

import { accountService } from "../src/lib/server/accounts/service";
import { exportRepository } from "../src/lib/server/repositories/export-repository";
import { exportJobRepository } from "../src/lib/server/repositories/export-job-repository";
import { jobRepository } from "../src/lib/server/repositories/job-repository";
import { webhookEventRepository } from "../src/lib/server/repositories/webhook-event-repository";
import { getDb, closeDbForTests } from "../src/lib/server/persistence/database";
import { isAdminIdentity } from "../src/lib/server/admin/guards";
import { listAdminJobs } from "../src/lib/server/admin/jobs-service";
import { listAdminWebhookReceipts } from "../src/lib/server/admin/webhooks-service";
import { listAdminExports } from "../src/lib/server/admin/exports-service";
import { getAdminHealthSnapshot } from "../src/lib/server/admin/health-service";
import { runAdminMaintenanceAction } from "../src/lib/server/admin/maintenance-service";
import { listAdminAccounts } from "../src/lib/server/admin/accounts-service";

function resetDb() {
  const db = getDb();
  db.exec(`
    DELETE FROM export_jobs;
    DELETE FROM exports;
    DELETE FROM webhook_events;
    DELETE FROM analysis_jobs;
    DELETE FROM analyses;
    DELETE FROM artifacts;
    DELETE FROM usage_snapshots;
    DELETE FROM entitlement_snapshots;
    DELETE FROM subscriptions;
    DELETE FROM accounts;
    DELETE FROM users;
  `);
}

test.beforeEach(() => resetDb());
test.after(() => {
  closeDbForTests();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("admin guard allowlist matches email or user id", () => {
  assert.equal(isAdminIdentity({ user_id: "x", email: "admin@example.com" }), true);
  assert.equal(isAdminIdentity({ user_id: "admin-user-1", email: "other@example.com" }), true);
  assert.equal(isAdminIdentity({ user_id: "x", email: "other@example.com" }), false);
});

test("jobs service lists and filters failures", () => {
  const now = new Date().toISOString();
  jobRepository.save({
    job_id: "job-analysis-1",
    analysis_id: "analysis-1",
    job_type: "analysis_v1",
    status: "failed",
    retry_count: 1,
    current_step: "Failed",
    error_code: "engine",
    error_message: "boom",
    created_at: now,
    finished_at: now,
  });
  exportJobRepository.save({
    export_job_id: "job-export-1",
    export_id: "export-1",
    analysis_id: "analysis-1",
    account_id: "account-1",
    format: "json",
    status: "queued",
    retry_count: 0,
    current_step: "Queued",
    created_at: now,
  });

  const all = listAdminJobs();
  assert.equal(all.summary.total, 2);
  assert.equal(all.summary.failed, 1);

  const failed = listAdminJobs({ status: "failed" });
  assert.equal(failed.rows.length, 1);
  assert.equal(failed.rows[0]?.kind, "analysis");
});

test("webhook service exposes failed/unprocessed and idempotent signals", () => {
  webhookEventRepository.saveReceived({ provider_event_id: "evt_1", event_type: "checkout.session.completed", payload_json: "{}" });
  webhookEventRepository.markFailed("evt_1", "bad signature");
  webhookEventRepository.saveReceived({ provider_event_id: "evt_2", event_type: "customer.subscription.updated", payload_json: "{}" });
  webhookEventRepository.markProcessed("evt_2");
  webhookEventRepository.saveReceived({ provider_event_id: "evt_2", event_type: "customer.subscription.updated", payload_json: "{}" });

  const failed = listAdminWebhookReceipts("failed");
  assert.equal(failed.rows.length, 1);
  assert.equal(failed.rows[0]?.provider_event_id, "evt_1");

  const all = listAdminWebhookReceipts();
  assert.equal(all.summary.idempotent_noop, 1);
});

test("exports service supports status views", () => {
  const { user, account } = accountService.ensureUserAndAccount({ email: "owner@example.com" });
  const now = new Date();
  exportRepository.save({
    export_id: "exp-1",
    analysis_id: "analysis-1",
    account_id: account.account_id,
    requested_by_user_id: user.user_id,
    format: "json",
    status: "failed",
    error_message: "render failed",
    requested_at: now.toISOString(),
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    expires_at: new Date(now.getTime() - 1000).toISOString(),
  });

  const failed = listAdminExports("failed");
  assert.equal(failed.rows.length, 1);
  const expired = listAdminExports("expired");
  assert.equal(expired.rows.length, 1);
});

test("health service returns structured snapshot", async () => {
  const snapshot = await getAdminHealthSnapshot();
  assert.equal(typeof snapshot.ok, "boolean");
  assert.ok(Array.isArray(snapshot.checks));
  assert.ok(snapshot.startup_validation_state === "ready" || snapshot.startup_validation_state === "degraded");
});

test("maintenance action execution returns structured counts", () => {
  const result = runAdminMaintenanceAction("sweep");
  assert.equal(typeof result, "object");
  assert.ok("expired_exports_removed" in result);
});

test("accounts overview returns plan/subscription and usage fields", () => {
  const { account } = accountService.ensureUserAndAccount({ email: "acct@example.com" });
  accountService.incrementUsage(account.account_id, "analysis");
  const overview = listAdminAccounts();
  assert.equal(overview.rows.length, 1);
  assert.equal(typeof overview.rows[0]?.entitlement_summary, "string");
});
