import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "invariance-phase7a-"));
process.env.INVARIANCE_DB_PATH = path.join(tempDir, "test.sqlite");

import { accountService } from "../src/lib/server/accounts/service";
import { analysisRepository } from "../src/lib/server/repositories/analysis-repository";
import { artifactRepository } from "../src/lib/server/repositories/artifact-repository";
import { jobRepository } from "../src/lib/server/repositories/job-repository";
import { webhookEventRepository } from "../src/lib/server/repositories/webhook-event-repository";
import { applyStripeWebhookEvent } from "../src/lib/server/billing/stripe-webhooks";
import { createAnalysisFromArtifact, getOwnedAnalysis, retryAnalysis } from "../src/lib/server/services/analysis-service";
import { getDb, closeDbForTests } from "../src/lib/server/persistence/database";
import { processNextAnalysisJob } from "../src/lib/server/workers/analysis-worker";

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

function seedArtifact(accountId: string, userId: string, artifactId: string) {
  artifactRepository.save({
    artifact_id: artifactId,
    owner_user_id: userId,
    account_id: accountId,
    file_name: "trades.csv",
    file_type: "text/csv",
    file_size_bytes: 120,
    storage_key: "uploads/trades.csv",
    checksum_sha256: "test-checksum",
    artifact_kind: "trade_csv",
    richness: "trade_only",
    uploaded_at: new Date().toISOString(),
    parsed_artifact: {
      artifact_id: artifactId,
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
}

test.beforeEach(() => resetDb());
test.after(() => {
  closeDbForTests();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("analysis enqueue + worker reaches terminal state and persists job", async () => {
  const { user, account } = accountService.ensureUserAndAccount({ email: "phase7a@example.com" });
  seedArtifact(account.account_id, user.user_id, "artifact-1");

  const created = createAnalysisFromArtifact({
    artifact_id: "artifact-1",
    owner_user_id: user.user_id,
    account_id: account.account_id,
    strategy_name: "Queued test",
  });

  while (await processNextAnalysisJob()) {
    // drain queued work
  }

  const analysis = analysisRepository.findById(created.analysis_id);
  const job = jobRepository.findByAnalysisId(created.analysis_id);
  assert.ok(analysis);
  assert.ok(job);
  assert.ok(["completed", "failed"].includes(analysis!.status));
  assert.ok(["completed", "failed"].includes(job!.status));
});

test("failed analysis can be safely re-queued with incremented retry count", () => {
  const { user, account } = accountService.ensureUserAndAccount({ email: "retry@example.com" });
  seedArtifact(account.account_id, user.user_id, "artifact-2");
  const created = createAnalysisFromArtifact({ artifact_id: "artifact-2", owner_user_id: user.user_id, account_id: account.account_id });

  analysisRepository.update(created.analysis_id, (current) => ({ ...current, status: "failed", failure_code: "engine_execution_failed", updated_at: new Date().toISOString() }));
  jobRepository.updateByAnalysisId(created.analysis_id, (current) => ({ ...current, status: "failed", retry_count: 0 }));

  const status = retryAnalysis(created.analysis_id);
  const job = jobRepository.findByAnalysisId(created.analysis_id);
  assert.ok(status);
  assert.equal(status!.status, "queued");
  assert.equal(job?.status, "queued");
  assert.equal(job?.retry_count, 1);
  assert.ok(job?.available_at);
});

test("stripe webhook processing is idempotent", () => {
  const { account } = accountService.ensureUserAndAccount({ email: "webhook@example.com" });

  const event = {
    id: "evt_idempotent_1",
    type: "checkout.session.completed",
    data: {
      object: {
        metadata: { account_id: account.account_id, plan_id: "professional" },
        customer: "cus_123",
        subscription: "sub_123",
      },
    },
  } as any;

  const first = applyStripeWebhookEvent(event);
  const second = applyStripeWebhookEvent(event);

  const receipt = webhookEventRepository.findByProviderEventId(event.id);
  assert.equal(first.idempotent, false);
  assert.equal(second.idempotent, true);
  assert.equal(receipt?.status, "processed");
  assert.equal(receipt?.attempt_count, 2);
});

test("ownership-safe retrieval remains enforced after queue lifecycle", () => {
  const a = accountService.ensureUserAndAccount({ email: "owner-a@example.com" });
  const b = accountService.ensureUserAndAccount({ email: "owner-b@example.com" });
  seedArtifact(a.account.account_id, a.user.user_id, "artifact-owner");

  const created = createAnalysisFromArtifact({ artifact_id: "artifact-owner", owner_user_id: a.user.user_id, account_id: a.account.account_id });
  const owned = getOwnedAnalysis(created.analysis_id, a.account.account_id);
  const notOwned = getOwnedAnalysis(created.analysis_id, b.account.account_id);

  assert.ok(owned);
  assert.equal(notOwned, undefined);
});
