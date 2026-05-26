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
import { artifactRepository } from "../src/lib/server/repositories/artifact-repository";
import { analysisRepository } from "../src/lib/server/repositories/analysis-repository";
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
    DELETE FROM prop_evaluation_results;
    DELETE FROM prop_evaluation_rule_snapshots;
    DELETE FROM prop_evaluation_rule_profiles;
    DELETE FROM wedge_learning_events;
    DELETE FROM report_reviewer_addenda;
    DELETE FROM research_desk_requests;
    DELETE FROM share_access_events;
    DELETE FROM evidence_events;
    DELETE FROM share_tokens;
    DELETE FROM export_jobs;
    DELETE FROM exports;
    DELETE FROM webhook_events;
    DELETE FROM report_snapshots;
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

test.beforeEach(() => resetDb());
test.after(() => {
  closeDbForTests();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function seedArtifactAndAnalysis(input: { account_id: string; user_id: string; artifact_id: string; analysis_id: string; status?: "queued" | "processing" | "completed" | "failed" }) {
  const now = new Date().toISOString();
  artifactRepository.save({
    artifact_id: input.artifact_id,
    owner_user_id: input.user_id,
    account_id: input.account_id,
    file_name: "trades.csv",
    file_type: "text/csv",
    file_size_bytes: 120,
    storage_key: `uploads/${input.artifact_id}.csv`,
    checksum_sha256: "abc",
    artifact_kind: "trade_csv",
    richness: "trade_only",
    uploaded_at: now,
    parsed_artifact: {
      artifact_id: input.artifact_id,
      artifact_type: "generic_trade_csv",
      artifact_kind: "trade_csv",
      richness: "trade_only",
      parser_notes: [],
      strategy_metadata: { strategy_name: "Test", timeframe: "1H", market: "BTCUSD" },
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
  analysisRepository.save({
    analysis_id: input.analysis_id,
    owner_user_id: input.user_id,
    account_id: input.account_id,
    status: input.status ?? "queued",
    strategy_name: "Test",
    artifact_id: input.artifact_id,
    created_at: now,
    updated_at: now,
  });
}

test("admin guard bootstraps allowlist identities into db-backed roles", async () => {
  const { user } = await accountService.ensureUserAndAccount({ email: "admin@example.com" });
  assert.equal(await isAdminIdentity({ user_id: user.user_id, email: user.email }), true);
  const other = await accountService.ensureUserAndAccount({ email: "other@example.com" });
  assert.equal(await isAdminIdentity({ user_id: other.user.user_id, email: other.user.email }), false);
});

test("jobs service lists and filters failures", async () => {
  const { user, account } = await accountService.ensureUserAndAccount({ email: "jobs@example.com" });
  seedArtifactAndAnalysis({ account_id: account.account_id, user_id: user.user_id, artifact_id: "artifact-1", analysis_id: "analysis-1" });
  const now = new Date().toISOString();
  jobRepository.save({
    job_id: "job-analysis-1",
    analysis_id: "analysis-1",
    account_id: account.account_id,
    job_type: "analysis_v1",
    status: "failed",
    retry_count: 1,
    current_step: "Failed",
    error_code: "engine",
    error_message: "boom",
    created_at: now,
    finished_at: now,
  });
  await exportJobRepository.save({
    export_job_id: "job-export-1",
    export_id: "export-1",
    analysis_id: "analysis-1",
    account_id: account.account_id,
    format: "pdf",
    status: "queued",
    retry_count: 0,
    current_step: "Queued",
    created_at: now,
  });

  const all = await listAdminJobs();
  assert.equal(all.summary.total, 2);
  assert.equal(all.summary.failed, 1);

  const failed = await listAdminJobs({ status: "failed" });
  assert.equal(failed.rows.length, 1);
  assert.equal(failed.rows[0]?.kind, "analysis");
});

test("webhook service exposes failed/unprocessed and idempotent signals", async () => {
  webhookEventRepository.saveReceived({ provider_event_id: "evt_1", event_type: "checkout.session.completed", payload_json: "{}" });
  webhookEventRepository.markFailed("evt_1", "bad signature");
  webhookEventRepository.saveReceived({ provider_event_id: "evt_2", event_type: "customer.subscription.updated", payload_json: "{}" });
  webhookEventRepository.markProcessed("evt_2");
  webhookEventRepository.saveReceived({ provider_event_id: "evt_2", event_type: "customer.subscription.updated", payload_json: "{}" });

  const failed = await listAdminWebhookReceipts("failed");
  assert.equal(failed.rows.length, 1);
  assert.equal(failed.rows[0]?.provider_event_id, "evt_1");

  const all = await listAdminWebhookReceipts();
  assert.equal(all.summary.idempotent_noop, 1);
});

test("exports service supports status views", async () => {
  const { user, account } = await accountService.ensureUserAndAccount({ email: "owner@example.com" });
  seedArtifactAndAnalysis({ account_id: account.account_id, user_id: user.user_id, artifact_id: "artifact-export-1", analysis_id: "analysis-1" });
  const now = new Date();
  exportRepository.save({
    export_id: "exp-1",
    analysis_id: "analysis-1",
    account_id: account.account_id,
    requested_by_user_id: user.user_id,
    format: "pdf",
    status: "failed",
    error_message: "render failed",
    requested_at: now.toISOString(),
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    expires_at: new Date(now.getTime() - 1000).toISOString(),
  });

  const failed = await listAdminExports("failed");
  assert.equal(failed.rows.length, 1);
  const expired = await listAdminExports("expired");
  assert.equal(expired.rows.length, 1);
});

test("health service returns structured snapshot", async () => {
  const snapshot = await getAdminHealthSnapshot();
  assert.equal(typeof snapshot.ok, "boolean");
  assert.ok(Array.isArray(snapshot.checks));
  assert.ok(["healthy", "degraded", "unhealthy"].includes(snapshot.startup_validation_state));
  assert.ok(snapshot.workers.analysis === "healthy" || snapshot.workers.analysis === "degraded" || snapshot.workers.analysis === "unhealthy");
});

test("maintenance action execution returns structured counts", async () => {
  const result = await runAdminMaintenanceAction("sweep");
  assert.equal(typeof result, "object");
  assert.ok("expired_exports_removed" in result);
});

test("accounts overview returns plan/subscription and usage fields", async () => {
  const { account } = await accountService.ensureUserAndAccount({ email: "acct@example.com" });
  await accountService.incrementUsage(account.account_id, "analysis");
  const overview = await listAdminAccounts();
  assert.equal(overview.rows.length, 1);
  assert.equal(typeof overview.rows[0]?.entitlement_summary, "string");
});
