import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "invariance-phase7b-"));
process.env.INVARIANCE_DB_PATH = path.join(tempDir, "test.sqlite");
process.env.INVARIANCE_STORAGE_ROOT = path.join(tempDir, "storage");

import { accountService } from "../src/lib/server/accounts/service";
import { artifactRepository } from "../src/lib/server/repositories/artifact-repository";
import { analysisRepository } from "../src/lib/server/repositories/analysis-repository";
import { createAnalysisFromArtifact, getAnalysisDetail } from "../src/lib/server/services/analysis-service";
import { processNextAnalysisJob } from "../src/lib/server/workers/analysis-worker";
import { requestExport, getExportOwned } from "../src/lib/server/exports/export-service";
import { processNextExportJob } from "../src/lib/server/workers/export-worker";
import { getObjectStorage } from "../src/lib/server/storage/object-storage";
import { getHealthSnapshot } from "../src/lib/server/ops/health-service";
import { cleanupExpiredExports } from "../src/lib/server/maintenance/retention-service";
import { exportRepository } from "../src/lib/server/repositories/export-repository";
import { getDb, closeDbForTests } from "../src/lib/server/persistence/database";

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
    checksum_sha256: "abc",
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

test("export request -> queue -> generated artifact", async () => {
  const { user, account } = accountService.ensureUserAndAccount({ email: "pro@example.com" });
  accountService.applySubscription({ account_id: account.account_id, provider_customer_id: "cus", provider_subscription_id: "sub", plan_id: "professional", status: "active" });
  seedArtifact(account.account_id, user.user_id, "artifact-e2e");
  const created = createAnalysisFromArtifact({ artifact_id: "artifact-e2e", owner_user_id: user.user_id, account_id: account.account_id });

  while (await processNextAnalysisJob()) {
    // drain
  }

  const detail = getAnalysisDetail(created.analysis_id);
  assert.equal(detail?.status, "completed");

  const exportReq = requestExport({ analysis_id: created.analysis_id, account_id: account.account_id, user_id: user.user_id, format: "json" });
  while (await processNextExportJob()) {
    // drain
  }

  const exported = getExportOwned(exportReq.export_id, account.account_id);
  assert.equal(exported?.status, "completed");
  assert.ok(exported?.storage_key);
  assert.equal(getObjectStorage().objectExists(exported!.storage_key!), true);
});

test("export access authorization is account-scoped", () => {
  const a = accountService.ensureUserAndAccount({ email: "exp-a@example.com" });
  const b = accountService.ensureUserAndAccount({ email: "exp-b@example.com" });
  exportRepository.save({
    export_id: "export-1",
    analysis_id: "analysis-1",
    account_id: a.account.account_id,
    requested_by_user_id: a.user.user_id,
    format: "json",
    status: "completed",
    storage_key: "exports/fake",
    content_type: "application/json",
    file_size_bytes: 2,
    checksum_sha256: "x",
    requested_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  assert.ok(getExportOwned("export-1", a.account.account_id));
  assert.equal(getExportOwned("export-1", b.account.account_id), undefined);
});

test("health checks show invalid config signal when stripe missing", async () => {
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;
  const snapshot = await getHealthSnapshot();
  const stripe = snapshot.checks.find((item) => item.name === "stripe_config");
  assert.ok(stripe);
  assert.equal(stripe?.ok, false);
});

test("retention cleanup deletes expired exports", () => {
  const now = new Date();
  const { user, account } = accountService.ensureUserAndAccount({ email: "retention@example.com" });
  const stored = getObjectStorage().putObject({ bucket: "exports", file_name: "old.json", content_type: "application/json", bytes: new Uint8Array(Buffer.from("{}")) });
  exportRepository.save({
    export_id: "expired-export",
    analysis_id: "analysis-old",
    account_id: account.account_id,
    requested_by_user_id: user.user_id,
    format: "json",
    status: "completed",
    storage_key: stored.storage_key,
    content_type: stored.content_type,
    file_size_bytes: stored.size_bytes,
    checksum_sha256: stored.checksum_sha256,
    requested_at: now.toISOString(),
    expires_at: new Date(now.getTime() - 1000).toISOString(),
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  });

  const result = cleanupExpiredExports(now);
  assert.equal(result.removed, 1);
  assert.equal(getObjectStorage().objectExists(stored.storage_key), false);
});
