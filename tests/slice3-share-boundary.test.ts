import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "invariance-slice3-share-"));
process.env.INVARIANCE_DB_PATH = path.join(tempDir, "test.sqlite");
process.env.INVARIANCE_STORAGE_ROOT = path.join(tempDir, "storage");

import { accountService } from "../src/lib/server/accounts/service";
import { analysisRepository } from "../src/lib/server/repositories/analysis-repository";
import { artifactRepository } from "../src/lib/server/repositories/artifact-repository";
import { ensureReportSnapshotForAnalysis } from "../src/lib/server/exports/report-snapshot-service";
import { renderExportFromSnapshot } from "../src/lib/server/exports/export-renderer";
import { shareAccessEventRepository, shareTokenRepository } from "../src/lib/server/repositories/share-token-repository";
import { createReportShare, hashShareToken, resolveSharedReport, revokeReportShare } from "../src/lib/server/share/share-service";
import { cleanupShareAccessEvents } from "../src/lib/server/maintenance/retention-service";
import { closeDbForTests, getDb } from "../src/lib/server/persistence/database";
import type { AnalysisRecord } from "../src/lib/contracts";

function resetDb() {
  getDb().exec(`
    DELETE FROM wedge_learning_events;
    DELETE FROM report_reviewer_addenda;
    DELETE FROM research_desk_requests;
    DELETE FROM share_access_events;
    DELETE FROM evidence_events;
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
    DELETE FROM admin_audit_log;
    DELETE FROM user_roles;
    DELETE FROM auth_tokens;
    DELETE FROM accounts;
    DELETE FROM users;
  `);
}

function analysisRecord(overrides: Partial<AnalysisRecord> = {}): AnalysisRecord {
  const base = {
    analysis_id: "analysis-slice3",
    status: "completed",
    created_at: "2026-05-15T00:00:00.000Z",
    updated_at: "2026-05-15T00:00:00.000Z",
    strategy: { strategy_name: "Share Boundary Strategy", symbols: ["SPY"], source_type: "upload", timeframe: "1D" },
    dataset: { trade_count: 24, market: "US", start_date: "2026-01-01", end_date: "2026-04-01" },
    run_context: { execution_model: "proxy", monte_carlo: "bootstrap", risk_model: "fixed" },
    summary: {
      headline_verdict: { status: "robust", title: "Robust", summary: "Evidence supports cautious deployment." },
      short_summary: "Evidence supports cautious deployment.",
      key_findings: ["Demand artifact can be shared safely."],
      warnings: [{ code: "LIMITED_EXECUTION", severity: "warning", title: "Limited", message: "Execution diagnostics are limited." }],
    },
    diagnostics: {
      overview: { metrics: [], interpretation: { title: "Overview", summary: "Overview." }, verdict: { status: "robust", title: "Robust", summary: "Supported." } },
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
      raw_result: { secret: "SENSITIVE_RAW_ENGINE_PAYLOAD" },
    },
    report: {
      report_id: "report-slice3",
      executive_summary: "SENSITIVE_OWNER_EXECUTIVE_SUMMARY",
      diagnostics_summary: ["Overview available."],
      methodology_assumptions: ["artifact_richness=trade_only"],
      limitations: ["Execution context is limited."],
      recommendations: ["Add live execution costs."],
      deployment_guidance: ["Run a paper-trading gate before scaling."],
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
    storage_key: `uploads/slice3/${artifactId}.csv`,
    checksum_sha256: "checksum",
    artifact_kind: "trade_csv",
    richness: "trade_only",
    uploaded_at: "2026-05-15T00:00:00.000Z",
    parsed_artifact: {
      artifact_kind: "trade_csv",
      artifact_type: "trade_csv",
      richness: "trade_only",
      strategy_metadata: { strategy_name: "Share Boundary Strategy" },
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

async function seedSnapshot(input: { email: string; analysis_id: string; artifact_id: string }) {
  const { user, account } = await accountService.ensureUserAndAccount({ email: input.email });
  await accountService.applySubscription({ account_id: account.account_id, provider_customer_id: `cus-${input.analysis_id}`, provider_subscription_id: `sub-${input.analysis_id}`, plan_id: "individual", status: "active" });
  seedArtifact(account.account_id, user.user_id, input.artifact_id);
  const record = analysisRecord({ analysis_id: input.analysis_id });
  analysisRepository.save({
    analysis_id: record.analysis_id,
    owner_user_id: user.user_id,
    account_id: account.account_id,
    status: "completed",
    artifact_id: input.artifact_id,
    created_at: record.created_at,
    updated_at: record.updated_at,
    result: record,
    eligibility_snapshot: artifactRepository.findById(input.artifact_id)?.eligibility_summary,
  });
  const snapshot = await ensureReportSnapshotForAnalysis(analysisRepository.findById(record.analysis_id)!);
  return { user, account, record, snapshot };
}

test.beforeEach(() => resetDb());
test.after(() => {
  closeDbForTests();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("share tokens are stored hashed and resolve to an allowlisted public report projection", async () => {
  const { user, account, snapshot } = await seedSnapshot({ email: "slice3-share@example.com", analysis_id: "analysis-slice3-share", artifact_id: "artifact-slice3-share" });
  const created = await createReportShare({ report_snapshot_id: snapshot.snapshot_id, account_id: account.account_id, user_id: user.user_id });

  const stored = await shareTokenRepository.findByTokenHash(hashShareToken(created.token));
  assert.ok(stored);
  assert.notEqual(stored.token_hash, created.token);

  const resolved = await resolveSharedReport({ token: created.token, ip: "203.0.113.10", userAgent: "slice3-test-agent" });
  assert.equal(resolved.status, "available");
  assert.equal(resolved.view?.strategy_name, "Share Boundary Strategy");
  assert.equal(resolved.view?.dataset.trade_count, 24);
  assert.equal(resolved.view?.evidence_ledger.some((entry) => entry.diagnostic === "execution"), true);
  assert.equal(resolved.view?.redaction_policy.raw_trade_files_public, false);
  assert.equal(resolved.view?.download_policy.public_pdf_download, false);
  assert.ok(resolved.view?.excluded_diagnostics.some((entry) => entry.diagnostic === "regimes"));

  const serialized = JSON.stringify(resolved.view);
  assert.equal(serialized.includes(account.account_id), false);
  assert.equal(serialized.includes(user.user_id), false);
  assert.equal(serialized.includes(snapshot.analysis_id), false);
  assert.equal(serialized.includes("engine_payload"), false);
  assert.equal(serialized.includes("raw_result"), false);
  assert.equal(serialized.includes("source_result_checksum"), false);
  assert.equal(serialized.includes("SENSITIVE_RAW_ENGINE_PAYLOAD"), false);
  assert.equal(serialized.includes("SENSITIVE_OWNER_EXECUTIVE_SUMMARY"), false);

  const events = await shareAccessEventRepository.listByShare(stored.share_id);
  assert.equal(events.length, 1);
  assert.equal(events[0].outcome, "viewed");
  assert.equal(typeof events[0].ip_hash, "string");
  assert.equal(typeof events[0].user_agent_hash, "string");
  assert.equal(JSON.stringify(events).includes("Share Boundary Strategy"), false);
});

test("report snapshots carry Phase 5 proof contract and export parity", async () => {
  const { snapshot } = await seedSnapshot({ email: "slice3-proof@example.com", analysis_id: "analysis-slice3-proof", artifact_id: "artifact-slice3-proof" });

  assert.equal(snapshot.payload.report_schema_version, "strategy_truth_room_report_snapshot_v1");
  assert.equal(snapshot.payload.artifact_identity.artifact_id, "artifact-slice3-proof");
  assert.equal(snapshot.payload.redaction_policy.pii_exposure, "none");
  assert.equal(snapshot.payload.redaction_policy.raw_trade_files_public, false);
  assert.ok(snapshot.payload.included_diagnostics.includes("overview"));
  assert.ok(snapshot.payload.excluded_diagnostics.some((entry) => entry.diagnostic === "stability"));

  const json = renderExportFromSnapshot(snapshot, "json");
  const md = renderExportFromSnapshot(snapshot, "md");
  const pdf = renderExportFromSnapshot(snapshot, "pdf");

  assert.equal(json.content_type, "application/json");
  assert.equal(md.content_type, "text/markdown");
  assert.equal(pdf.content_type, "application/pdf");
  assert.ok(Buffer.from(json.bytes).toString("utf-8").includes("evidence_coverage"));
  assert.ok(Buffer.from(md.bytes).toString("utf-8").includes("## Evidence Coverage"));
  assert.ok(Buffer.from(pdf.bytes).toString("utf-8").includes("%PDF-1.4"));
});

test("expired and revoked shares do not return report content", async () => {
  const { user, account, snapshot } = await seedSnapshot({ email: "slice3-expiry@example.com", analysis_id: "analysis-slice3-expiry", artifact_id: "artifact-slice3-expiry" });
  const expired = await createReportShare({
    report_snapshot_id: snapshot.snapshot_id,
    account_id: account.account_id,
    user_id: user.user_id,
    expires_at: "2026-05-14T00:00:00.000Z",
  });
  const expiredResult = await resolveSharedReport({ token: expired.token, now: new Date("2026-05-15T00:00:00.000Z") });
  assert.equal(expiredResult.status, "expired");
  assert.equal(expiredResult.view, undefined);

  const active = await createReportShare({ report_snapshot_id: snapshot.snapshot_id, account_id: account.account_id, user_id: user.user_id });
  await revokeReportShare({ share_id: active.share.share_id, account_id: account.account_id, revoked_at: "2026-05-15T00:10:00.000Z" });
  const revokedResult = await resolveSharedReport({ token: active.token });
  assert.equal(revokedResult.status, "revoked");
  assert.equal(revokedResult.view, undefined);
});

test("shares follow snapshot lifecycle and reject cross-account creation", async () => {
  const { user, account, record, snapshot } = await seedSnapshot({ email: "slice3-superseded@example.com", analysis_id: "analysis-slice3-superseded", artifact_id: "artifact-slice3-superseded" });
  const created = await createReportShare({ report_snapshot_id: snapshot.snapshot_id, account_id: account.account_id, user_id: user.user_id });

  analysisRepository.update(record.analysis_id, (current) => ({
    ...current,
    updated_at: "2026-05-15T00:05:00.000Z",
    result: analysisRecord({
      analysis_id: record.analysis_id,
      updated_at: "2026-05-15T00:05:00.000Z",
      summary: { ...record.summary, short_summary: "Changed source result." },
    }),
  }));
  const replacement = await ensureReportSnapshotForAnalysis(analysisRepository.findById(record.analysis_id)!);
  assert.notEqual(replacement.snapshot_id, snapshot.snapshot_id);

  const supersededResult = await resolveSharedReport({ token: created.token });
  assert.equal(supersededResult.status, "superseded");
  assert.equal(supersededResult.view?.status, "superseded");

  await assert.rejects(
    () => createReportShare({ report_snapshot_id: snapshot.snapshot_id, account_id: account.account_id, user_id: user.user_id }),
    /report_snapshot_superseded/,
  );

  const { account: otherAccount } = await accountService.ensureUserAndAccount({ email: "slice3-other@example.com" });
  await assert.rejects(
    () => createReportShare({ report_snapshot_id: replacement.snapshot_id, account_id: otherAccount.account_id, user_id: user.user_id }),
    /report_snapshot_not_found/,
  );
});

test("share access event retention removes old audit events without deleting snapshots or tokens", async () => {
  const { user, account, snapshot } = await seedSnapshot({ email: "slice3-retention@example.com", analysis_id: "analysis-slice3-retention", artifact_id: "artifact-slice3-retention" });
  const created = await createReportShare({ report_snapshot_id: snapshot.snapshot_id, account_id: account.account_id, user_id: user.user_id });
  const resolved = await resolveSharedReport({ token: created.token });
  assert.equal(resolved.status, "available");

  const events = await shareAccessEventRepository.listByShare(created.share.share_id);
  assert.equal(events.length, 1);
  getDb()
    .prepare("UPDATE share_access_events SET created_at = ? WHERE event_id = ?")
    .run("2026-01-01T00:00:00.000Z", events[0].event_id);

  const cleanup = cleanupShareAccessEvents(new Date("2026-05-15T00:00:00.000Z"), 30);
  assert.equal(cleanup.removed, 1);
  assert.ok(await shareTokenRepository.findById(created.share.share_id));
  assert.equal((await resolveSharedReport({ token: created.token })).status, "available");
});
