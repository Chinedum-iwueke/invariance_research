import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "invariance-slice2-snapshots-"));
process.env.INVARIANCE_DB_PATH = path.join(tempDir, "test.sqlite");
process.env.INVARIANCE_STORAGE_ROOT = path.join(tempDir, "storage");

import { accountService } from "../src/lib/server/accounts/service";
import { analysisRepository } from "../src/lib/server/repositories/analysis-repository";
import { artifactRepository } from "../src/lib/server/repositories/artifact-repository";
import { requestExport, getExportOwned } from "../src/lib/server/exports/export-service";
import { ensureReportSnapshotForAnalysis, getReportSnapshotState } from "../src/lib/server/exports/report-snapshot-service";
import { processNextExportJob } from "../src/lib/server/workers/export-worker";
import { getObjectStorage } from "../src/lib/server/storage/object-storage";
import { closeDbForTests, getDb } from "../src/lib/server/persistence/database";
import type { AnalysisRecord } from "../src/lib/contracts";

function resetDb() {
  getDb().exec(`
    DELETE FROM share_access_events;
    DELETE FROM share_tokens;
    DELETE FROM export_jobs;
    DELETE FROM exports;
    DELETE FROM report_snapshots;
    DELETE FROM analysis_jobs;
    DELETE FROM analyses;
    DELETE FROM artifacts;
    DELETE FROM usage_snapshots;
    DELETE FROM entitlement_snapshots;
    DELETE FROM subscriptions;
    DELETE FROM auth_tokens;
    DELETE FROM user_roles;
    DELETE FROM accounts;
    DELETE FROM users;
  `);
}

function analysisRecord(overrides: Partial<AnalysisRecord> = {}): AnalysisRecord {
  const base = {
    analysis_id: "analysis-slice2",
    status: "completed",
    created_at: "2026-05-15T00:00:00.000Z",
    updated_at: "2026-05-15T00:00:00.000Z",
    strategy: { strategy_name: "Snapshot Strategy", symbols: ["SPY"], source_type: "upload", timeframe: "1D" },
    dataset: { trade_count: 12, market: "US", start_date: "2026-01-01", end_date: "2026-03-01" },
    run_context: { execution_model: "proxy", monte_carlo: "bootstrap", risk_model: "fixed" },
    summary: {
      headline_verdict: { status: "moderate", title: "Conditional", summary: "Conditional evidence profile." },
      short_summary: "Conditional evidence profile.",
      key_findings: ["Execution evidence is limited."],
      warnings: [{ code: "LIMITED_EXECUTION", severity: "warning", title: "Limited", message: "Execution diagnostics are limited." }],
    },
    diagnostics: {
      overview: { metrics: [], interpretation: { title: "Overview", summary: "Overview." }, verdict: { status: "moderate", title: "Conditional", summary: "Conditional." } },
      distribution: { metrics: [], figures: [], interpretation: { title: "Distribution", summary: "Distribution." } },
      monte_carlo: { metrics: [], figure: { figure_id: "mc", title: "Monte Carlo", type: "line", series: [] }, interpretation: { title: "Monte Carlo", summary: "Path risk." }, warnings: [], recommendations: [] },
      stability: { metrics: [], interpretation: { title: "Stability", summary: "" }, locked: true },
      execution: { metrics: [], scenarios: [], interpretation: { title: "Execution", summary: "" }, recommendations: [] },
      regimes: { metrics: [], regime_metrics: [], interpretation: { title: "Regimes", summary: "" }, locked: true },
      ruin: { metrics: [], assumptions: [], interpretation: { title: "Ruin", summary: "" }, recommendations: [] },
    },
    engine_payload: {
      summary_metrics: [],
      diagnostics: { overview: { status: "available", summary_metrics: [], figures: [], assumptions: [], warnings: [], recommendations: [], limitations: [] } },
      report_sections: { assumptions: [], limitations: [], recommendations: [] },
      raw_result: {},
    },
    report: {
      report_id: "report-slice2",
      executive_summary: "Snapshot-ready report summary.",
      diagnostics_summary: ["Overview available."],
      methodology_assumptions: ["artifact_richness=trade_only"],
      limitations: ["Execution context is limited."],
      recommendations: ["Add live execution costs."],
      deployment_guidance: ["Do not scale without execution evidence."],
      figures: [],
      source: "summary_fallback",
      export_ready: true,
      generated_at: "2026-05-15T00:01:00.000Z",
    },
    access: { can_view_stability: false, can_view_regimes: false, can_view_ruin: true, can_export_report: true },
    diagnostic_statuses: {
      overview: { status: "available", available: true, limited: false, unavailable: false, skipped: false },
      distribution: { status: "available", available: true, limited: false, unavailable: false, skipped: false },
      monte_carlo: { status: "available", available: true, limited: false, unavailable: false, skipped: false },
      stability: { status: "skipped", available: false, limited: false, unavailable: false, skipped: true, reason: "Parameter metadata missing." },
      execution: { status: "limited", available: false, limited: true, unavailable: false, skipped: false, reason: "Execution assumptions limited." },
      regimes: { status: "skipped", available: false, limited: false, unavailable: false, skipped: true, reason: "OHLCV missing." },
      ruin: { status: "available", available: true, limited: false, unavailable: false, skipped: false },
      report: { status: "limited", available: false, limited: true, unavailable: false, skipped: false, reason: "Report includes limitations." },
    },
  } as AnalysisRecord;

  return { ...base, ...overrides } as AnalysisRecord;
}

function seedArtifact(accountId: string, userId: string, artifactId: string) {
  artifactRepository.save({
    artifact_id: artifactId,
    owner_user_id: userId,
    account_id: accountId,
    file_name: "trades.csv",
    file_type: "text/csv",
    file_size_bytes: 128,
    storage_key: "uploads/slice2/trades.csv",
    checksum_sha256: "checksum",
    artifact_kind: "trade_csv",
    richness: "trade_only",
    uploaded_at: "2026-05-15T00:00:00.000Z",
    parsed_artifact: {
      artifact_kind: "trade_csv",
      artifact_type: "trade_csv",
      richness: "trade_only",
      strategy_metadata: { strategy_name: "Snapshot Strategy" },
      trades: [],
      ohlcv_present: false,
      benchmark_present: false,
      diagnostic_eligibility: {} as never,
      validation: { valid: true, errors: [], warnings: [] },
      parser_notes: [],
    },
    eligibility_summary: {
      accepted: true,
      detected_artifact_type: "trade_csv",
      detected_richness: "trade_only",
      diagnostics_available: ["overview", "distribution", "monte_carlo", "execution", "ruin", "report"],
      diagnostics_limited: [],
      diagnostics_unavailable: ["stability", "regimes"],
      limitation_reasons: ["Parameter metadata missing.", "OHLCV missing."],
      parser_notes: [],
      summary_text: "Trade CSV accepted.",
    },
  });
}

test.beforeEach(() => resetDb());
test.after(() => {
  closeDbForTests();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("report snapshot generation is idempotent for unchanged completed analysis", async () => {
  const { user, account } = await accountService.ensureUserAndAccount({ email: "slice2@example.com" });
  await accountService.applySubscription({ account_id: account.account_id, provider_customer_id: "cus", provider_subscription_id: "sub", plan_id: "professional", status: "active" });
  seedArtifact(account.account_id, user.user_id, "artifact-slice2");
  const record = analysisRecord();
  analysisRepository.save({
    analysis_id: record.analysis_id,
    owner_user_id: user.user_id,
    account_id: account.account_id,
    status: "completed",
    artifact_id: "artifact-slice2",
    created_at: record.created_at,
    updated_at: record.updated_at,
    result: record,
    eligibility_snapshot: artifactRepository.findById("artifact-slice2")?.eligibility_summary,
  });

  const analysis = analysisRepository.findById(record.analysis_id)!;
  const first = ensureReportSnapshotForAnalysis(analysis);
  const second = ensureReportSnapshotForAnalysis(analysis);

  assert.equal(second.snapshot_id, first.snapshot_id);
  assert.equal(second.status, "active");
  assert.equal(second.payload.record.analysis_id, record.analysis_id);
  assert.equal(second.payload.evidence_ledger?.by_diagnostic.execution.final_status, "limited");
});

test("owner exports render from pinned report snapshots", async () => {
  const { user, account } = await accountService.ensureUserAndAccount({ email: "slice2-export@example.com" });
  await accountService.applySubscription({ account_id: account.account_id, provider_customer_id: "cus2", provider_subscription_id: "sub2", plan_id: "professional", status: "active" });
  seedArtifact(account.account_id, user.user_id, "artifact-slice2-export");
  const record = analysisRecord({ analysis_id: "analysis-slice2-export" });
  analysisRepository.save({
    analysis_id: record.analysis_id,
    owner_user_id: user.user_id,
    account_id: account.account_id,
    status: "completed",
    artifact_id: "artifact-slice2-export",
    created_at: record.created_at,
    updated_at: record.updated_at,
    result: record,
    eligibility_snapshot: artifactRepository.findById("artifact-slice2-export")?.eligibility_summary,
  });

  const requested = await requestExport({ analysis_id: record.analysis_id, account_id: account.account_id, user_id: user.user_id, format: "json" });
  assert.ok(requested.report_snapshot_id);
  while (await processNextExportJob()) {
    // drain
  }

  const exported = getExportOwned(requested.export_id, account.account_id);
  assert.equal(exported?.status, "completed");
  assert.equal(exported?.report_snapshot_id, requested.report_snapshot_id);
  const payload = JSON.parse(Buffer.from(await getObjectStorage().getObject(exported!.storage_key!)).toString("utf-8"));
  assert.equal(payload.snapshot_id, requested.report_snapshot_id);
  assert.equal(payload.record.analysis_id, record.analysis_id);
});

test("snapshot state reports stale source analysis after result changes", async () => {
  const { user, account } = await accountService.ensureUserAndAccount({ email: "slice2-stale@example.com" });
  seedArtifact(account.account_id, user.user_id, "artifact-slice2-stale");
  const record = analysisRecord({ analysis_id: "analysis-slice2-stale" });
  analysisRepository.save({
    analysis_id: record.analysis_id,
    owner_user_id: user.user_id,
    account_id: account.account_id,
    status: "completed",
    artifact_id: "artifact-slice2-stale",
    created_at: record.created_at,
    updated_at: record.updated_at,
    result: record,
    eligibility_snapshot: artifactRepository.findById("artifact-slice2-stale")?.eligibility_summary,
  });
  const analysis = analysisRepository.findById(record.analysis_id)!;
  ensureReportSnapshotForAnalysis(analysis);

  const changed = analysisRecord({ analysis_id: record.analysis_id, summary: { ...record.summary, short_summary: "Changed." } });
  analysisRepository.update(record.analysis_id, (current) => ({ ...current, result: changed, updated_at: "2026-05-15T00:05:00.000Z" }));
  const state = getReportSnapshotState(analysisRepository.findById(record.analysis_id)!);

  assert.equal(state.stale, true);
  assert.equal(state.warnings.some((warning) => /stale/i.test(warning)), true);
});

test("report snapshot generation is guarded by completed analysis state", async () => {
  const { user, account } = await accountService.ensureUserAndAccount({ email: "slice2-guard@example.com" });
  seedArtifact(account.account_id, user.user_id, "artifact-slice2-guard");
  analysisRepository.save({
    analysis_id: "analysis-slice2-guard",
    owner_user_id: user.user_id,
    account_id: account.account_id,
    status: "processing",
    artifact_id: "artifact-slice2-guard",
    created_at: "2026-05-15T00:00:00.000Z",
    updated_at: "2026-05-15T00:00:00.000Z",
  });

  assert.throws(() => ensureReportSnapshotForAnalysis(analysisRepository.findById("analysis-slice2-guard")!), /analysis_not_completed/);
});
