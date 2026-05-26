import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "invariance-phase7b-"));
process.env.INVARIANCE_DB_PATH = path.join(tempDir, "test.sqlite");
process.env.INVARIANCE_STORAGE_ROOT = path.join(tempDir, "storage");
process.env.WORKER_MODE = "external";

import { accountService } from "../src/lib/server/accounts/service";
import { artifactRepository } from "../src/lib/server/repositories/artifact-repository";
import { analysisRepository } from "../src/lib/server/repositories/analysis-repository";
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
    DELETE FROM prop_evaluation_results;
    DELETE FROM prop_evaluation_rule_snapshots;
    DELETE FROM prop_evaluation_rule_profiles;
    DELETE FROM wedge_learning_events;
    DELETE FROM report_reviewer_addenda;
    DELETE FROM research_desk_requests;
    DELETE FROM share_access_events;
    DELETE FROM share_tokens;
    DELETE FROM evidence_events;
    DELETE FROM export_jobs;
    DELETE FROM exports;
    DELETE FROM report_snapshots;
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

function seedCompletedAnalysis(accountId: string, userId: string, artifactId: string, analysisId: string) {
  const now = new Date().toISOString();
  analysisRepository.save({
    analysis_id: analysisId,
    owner_user_id: userId,
    account_id: accountId,
    status: "completed",
    strategy_name: "Test",
    artifact_id: artifactId,
    created_at: now,
    updated_at: now,
    eligibility_snapshot: artifactRepository.findById(artifactId)?.eligibility_summary,
    result: {
      analysis_id: analysisId,
      status: "completed",
      created_at: now,
      updated_at: now,
      strategy: { strategy_name: "Test", symbols: ["BTC"], source_type: "upload" },
      dataset: { market: "BTCUSD", trade_count: 0 },
      run_context: { execution_model: "baseline", monte_carlo: "none", risk_model: "fixed" },
      summary: { headline_verdict: { status: "moderate", title: "Conditional", summary: "Fixture." }, short_summary: "Fixture.", key_findings: [], warnings: [] },
      diagnostics: {
        overview: { metrics: [], figures: [], interpretation: { title: "Overview", summary: "" }, verdict: { status: "moderate", title: "", summary: "" } },
        distribution: { metrics: [], figures: [], interpretation: { title: "Distribution", summary: "" } },
        monte_carlo: { metrics: [], figures: [], interpretation: { title: "Monte Carlo", summary: "" } },
        stability: { metrics: [], interpretation: { title: "Stability", summary: "" }, locked: true },
        execution: { metrics: [], figures: [], interpretation: { title: "Execution", summary: "" } },
        regimes: { metrics: [], figures: [], interpretation: { title: "Regimes", summary: "" }, locked: true },
        ruin: { metrics: [], interpretation: { title: "Ruin", summary: "" }, assumptions: [] },
      },
      engine_payload: {
        summary_metrics: [],
        diagnostics: { overview: { status: "available", summary_metrics: [], figures: [], assumptions: [], warnings: [], recommendations: [], limitations: [] } },
        report_sections: { assumptions: [], limitations: [], recommendations: [] },
        raw_result: {},
      },
      report: {
        report_id: `report-${analysisId}`,
        executive_summary: "Fixture report.",
        diagnostics_summary: [],
        methodology_assumptions: [],
        limitations: [],
        recommendations: [],
        deployment_guidance: [],
        figures: [],
        source: "summary_fallback",
        export_ready: true,
        generated_at: now,
      },
      diagnostic_statuses: {
        overview: { status: "available", available: true, limited: false, unavailable: false, skipped: false },
        distribution: { status: "available", available: true, limited: false, unavailable: false, skipped: false },
        monte_carlo: { status: "available", available: true, limited: false, unavailable: false, skipped: false },
        stability: { status: "skipped", available: false, limited: false, unavailable: false, skipped: true },
        execution: { status: "available", available: true, limited: false, unavailable: false, skipped: false },
        regimes: { status: "skipped", available: false, limited: false, unavailable: false, skipped: true },
        ruin: { status: "available", available: true, limited: false, unavailable: false, skipped: false },
        report: { status: "available", available: true, limited: false, unavailable: false, skipped: false },
      },
    } as any,
  });
}

test.beforeEach(() => resetDb());
test.after(() => {
  closeDbForTests();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("export request -> queue -> generated artifact", async () => {
  const { user, account } = await accountService.ensureUserAndAccount({ email: "pro@example.com" });
  await accountService.applySubscription({ account_id: account.account_id, provider_customer_id: "cus", provider_subscription_id: "sub", plan_id: "professional", status: "active" });
  seedArtifact(account.account_id, user.user_id, "artifact-e2e");
  seedCompletedAnalysis(account.account_id, user.user_id, "artifact-e2e", "analysis-e2e");

  const exportReq = await requestExport({ analysis_id: "analysis-e2e", account_id: account.account_id, user_id: user.user_id, format: "json" });
  while (await processNextExportJob()) {
    // drain
  }

  const exported = await getExportOwned(exportReq.export_id, account.account_id);
  assert.equal(exported?.status, "completed");
  assert.ok(exported?.storage_key);
  assert.equal(await getObjectStorage().objectExists(exported!.storage_key!), true);
});

test("export access authorization is account-scoped", async () => {
  const a = await accountService.ensureUserAndAccount({ email: "exp-a@example.com" });
  const b = await accountService.ensureUserAndAccount({ email: "exp-b@example.com" });
  seedArtifact(a.account.account_id, a.user.user_id, "artifact-export-access");
  analysisRepository.save({
    analysis_id: "analysis-1",
    owner_user_id: a.user.user_id,
    account_id: a.account.account_id,
    status: "completed",
    artifact_id: "artifact-export-access",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
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
  assert.ok(await getExportOwned("export-1", a.account.account_id));
  assert.equal(await getExportOwned("export-1", b.account.account_id), undefined);
});

test("health checks show invalid config signal when stripe missing", async () => {
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;
  const snapshot = await getHealthSnapshot();
  const stripe = snapshot.checks.find((item) => item.name === "stripe_config");
  assert.ok(stripe);
  assert.equal(stripe?.status, "degraded");
});

test("retention cleanup deletes expired exports", async () => {
  const now = new Date();
  const { user, account } = await accountService.ensureUserAndAccount({ email: "retention@example.com" });
  seedArtifact(account.account_id, user.user_id, "artifact-retention");
  analysisRepository.save({
    analysis_id: "analysis-old",
    owner_user_id: user.user_id,
    account_id: account.account_id,
    status: "completed",
    artifact_id: "artifact-retention",
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  });
  const stored = await getObjectStorage().putObject({ bucket: "reports", file_name: "old.json", content_type: "application/json", bytes: new Uint8Array(Buffer.from("{}")) });
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

  const result = await cleanupExpiredExports(now);
  assert.equal(result.removed, 1);
  assert.equal(await getObjectStorage().objectExists(stored.storage_key), false);
});
