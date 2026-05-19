import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "invariance-phase55-"));
process.env.INVARIANCE_DB_PATH = path.join(tempDir, "test.sqlite");
process.env.INVARIANCE_STORAGE_ROOT = path.join(tempDir, "storage");

import { accountService } from "../src/lib/server/accounts/service";
import { analysisRepository } from "../src/lib/server/repositories/analysis-repository";
import { artifactRepository } from "../src/lib/server/repositories/artifact-repository";
import { ensureReportSnapshotForAnalysis } from "../src/lib/server/exports/report-snapshot-service";
import { getValidationCommandLayer } from "../src/lib/server/evidence/validation-command-service";
import { createReportShare, resolveSharedReport } from "../src/lib/server/share/share-service";
import { requestExport } from "../src/lib/server/exports/export-service";
import { processNextExportJob } from "../src/lib/server/workers/export-worker";
import { closeDbForTests, getDb } from "../src/lib/server/persistence/database";
import type { AnalysisRecord } from "../src/lib/contracts";

function resetDb() {
  getDb().exec(`
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
    DELETE FROM auth_tokens;
    DELETE FROM user_roles;
    DELETE FROM accounts;
    DELETE FROM users;
  `);
}

function analysisRecord(analysisId = "analysis-phase55"): AnalysisRecord {
  return {
    analysis_id: analysisId,
    status: "completed",
    created_at: "2026-05-19T00:00:00.000Z",
    updated_at: "2026-05-19T00:02:00.000Z",
    strategy: { strategy_name: "Command Layer Strategy", symbols: ["BTCUSDT"], source_type: "upload", timeframe: "1H" },
    dataset: { trade_count: 30, market: "crypto", start_date: "2026-01-01", end_date: "2026-03-01" },
    run_context: { execution_model: "fee/slippage stress", monte_carlo: "bootstrap", risk_model: "configured" },
    summary: {
      headline_verdict: { status: "moderate", title: "Promising but under-supported", summary: "Execution evidence is incomplete." },
      short_summary: "Execution evidence is incomplete.",
      key_findings: ["Broker/fill evidence is missing."],
      warnings: [{ code: "EXECUTION_LIMITED", severity: "warning", title: "Execution limited", message: "Broker exports are missing." }],
    },
    diagnostics: {
      overview: { metrics: [], figure: { figure_id: "eq", title: "Equity", type: "line", series: [] }, interpretation: { title: "Overview", summary: "Moderate." }, verdict: { status: "moderate", title: "Moderate", summary: "Moderate." } },
      distribution: { metrics: [], figures: [], interpretation: { title: "Distribution", summary: "Some outlier dependence." }, assumptions: [], limitations: [] },
      monte_carlo: { metrics: [], figure: { figure_id: "mc", title: "Monte Carlo", type: "line", series: [] }, interpretation: { title: "Monte Carlo", summary: "Survival is conditional." }, warnings: [], assumptions: [], limitations: [] },
      stability: { metrics: [], interpretation: { title: "Stability", summary: "" }, locked: true, limitations: ["Parameter sweep missing."] },
      execution: { metrics: [], scenarios: [], interpretation: { title: "Execution", summary: "Broker evidence missing." }, assumptions: ["Proxy costs are used."], limitations: ["Broker/fill export missing."], recommendations: [] },
      regimes: { metrics: [], regime_metrics: [], interpretation: { title: "Regimes", summary: "" }, locked: true, limitations: ["OHLCV missing."] },
      ruin: { metrics: [], assumptions: [], interpretation: { title: "Ruin", summary: "Sizing provided." }, recommendations: [] },
    },
    engine_payload: {
      summary_metrics: [],
      diagnostics: { overview: { status: "available", summary_metrics: [], figures: [], assumptions: [], warnings: [], recommendations: [], limitations: [] } },
      report_sections: { assumptions: [], limitations: ["Broker exports are missing."], recommendations: ["Upload broker fills."] },
      raw_result: {},
    },
    assumption_ledger: [{
      assumption_id: "A001",
      source: "missing_input",
      diagnostic: "execution",
      statement: "Execution realism is limited because broker/fill exports were not supplied.",
      materiality: "critical",
      confidence: "high",
      rescue_evidence: "Attach broker/fill exports.",
      share_safe: true,
    }],
    claim_inventory: [{
      claim_id: "claim_execution",
      claim: "The backtest execution assumptions are realistic enough for decisioning.",
      source: "engine_default",
      priority: "critical",
      support_status: "unsupported",
      supporting_diagnostics: ["execution"],
      contradicting_diagnostics: [],
      missing_evidence: ["broker/fill export"],
      report_wording: "Claim is unsupported under the supplied artifact bundle.",
    }],
    proof_report: {
      executive_verdict: { taxonomy: "promising_but_under_supported", summary: "Evidence is promising but incomplete." },
      critical_assumptions: [{
        assumption_id: "A001",
        source: "missing_input",
        diagnostic: "execution",
        statement: "Execution realism is limited because broker/fill exports were not supplied.",
        materiality: "critical",
        confidence: "high",
        rescue_evidence: "Attach broker/fill exports.",
        share_safe: true,
      }],
      unsupported_claims: [],
      limitations: ["Broker/fill export missing."],
      next_evidence: ["Attach broker/fill exports."],
      what_this_result_does_not_prove: ["It does not prove live execution realism."],
    },
    report: {
      report_id: "report-phase55",
      executive_summary: "Command layer report.",
      diagnostics_summary: ["Overview available."],
      methodology_assumptions: ["trade artifact only"],
      limitations: ["Broker/fill export missing."],
      recommendations: ["Upload broker fills."],
      deployment_guidance: ["Do not scale without fill evidence."],
      figures: [],
      source: "summary_fallback",
      export_ready: true,
      generated_at: "2026-05-19T00:03:00.000Z",
    },
    access: { can_view_stability: false, can_view_regimes: false, can_view_ruin: true, can_export_report: true },
    diagnostic_statuses: {
      overview: { status: "available", available: true, limited: false, unavailable: false, skipped: false },
      distribution: { status: "available", available: true, limited: false, unavailable: false, skipped: false },
      monte_carlo: { status: "available", available: true, limited: false, unavailable: false, skipped: false },
      stability: { status: "skipped", available: false, limited: false, unavailable: false, skipped: true, reason: "Parameter sweep missing." },
      execution: { status: "limited", available: false, limited: true, unavailable: false, skipped: false, reason: "Broker/fill export missing." },
      regimes: { status: "skipped", available: false, limited: false, unavailable: false, skipped: true, reason: "OHLCV missing." },
      ruin: { status: "available", available: true, limited: false, unavailable: false, skipped: false },
      report: { status: "limited", available: false, limited: true, unavailable: false, skipped: false, reason: "Report includes limitations." },
    },
  };
}

function seedArtifact(accountId: string, userId: string, artifactId: string) {
  artifactRepository.save({
    artifact_id: artifactId,
    owner_user_id: userId,
    account_id: accountId,
    file_name: "trades.csv",
    file_type: "text/csv",
    file_size_bytes: 512,
    storage_key: "uploads/phase55/trades.csv",
    checksum_sha256: "phase55-checksum",
    artifact_kind: "trade_csv",
    richness: "trade_only",
    uploaded_at: "2026-05-19T00:00:00.000Z",
    parsed_artifact: {
      artifact_kind: "trade_csv",
      artifact_type: "trade_csv",
      richness: "trade_only",
      strategy_metadata: { strategy_name: "Command Layer Strategy" },
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
      diagnostics_limited: ["execution", "report"],
      diagnostics_unavailable: ["stability", "regimes"],
      limitation_reasons: ["Broker/fill export missing.", "OHLCV missing.", "Parameter sweep missing."],
      parser_notes: [],
      summary_text: "Trade CSV accepted with limited execution evidence.",
    },
  });
}

async function seedCompletedAnalysis() {
  const { user, account } = await accountService.ensureUserAndAccount({ email: "phase55@example.com" });
  await accountService.applySubscription({ account_id: account.account_id, provider_customer_id: "cus55", provider_subscription_id: "sub55", plan_id: "professional", status: "active" });
  seedArtifact(account.account_id, user.user_id, "artifact-phase55");
  const record = analysisRecord();
  analysisRepository.save({
    analysis_id: record.analysis_id,
    owner_user_id: user.user_id,
    account_id: account.account_id,
    status: "completed",
    artifact_id: "artifact-phase55",
    created_at: record.created_at,
    updated_at: record.updated_at,
    result: record,
    eligibility_snapshot: artifactRepository.findById("artifact-phase55")?.eligibility_summary,
  });
  return { user, account, record, analysis: analysisRepository.findById(record.analysis_id)! };
}

test.beforeEach(() => resetDb());
test.after(() => {
  closeDbForTests();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("Phase 5.5 command layer exposes commands, explanations, alerts, and case-file timeline", async () => {
  const { user, account, analysis } = await seedCompletedAnalysis();
  const snapshot = ensureReportSnapshotForAnalysis(analysis);
  await requestExport({ analysis_id: analysis.analysis_id, account_id: account.account_id, user_id: user.user_id, format: "json" });
  while (await processNextExportJob()) {
    // drain
  }
  const share = createReportShare({ report_snapshot_id: snapshot.snapshot_id, account_id: account.account_id, user_id: user.user_id });
  resolveSharedReport({ token: share.token, ip: "127.0.0.1", userAgent: "node-test" });

  const layer = await getValidationCommandLayer({ analysis_id: analysis.analysis_id, account_id: account.account_id });

  assert.equal(layer.schema_version, "validation_command_layer_v1");
  assert.ok(layer.commands.some((command) => command.id === "explain_verdict" && command.kind === "navigate"));
  assert.ok(layer.commands.some((command) => command.id === "export_pdf" && command.kind === "api"));
  assert.ok(layer.commands.some((command) => command.id === "compare_previous_run" && command.kind === "blocked"));
  assert.ok(layer.saved_questions.some((item) => /what evidence is missing/i.test(item.question)));
  assert.ok(layer.explanations.some((item) => item.id === "why_verdict" && item.redaction_safe));
  assert.ok(layer.alerts.some((event) => event.event_type === "snapshot_generated"));
  assert.ok(layer.alerts.some((event) => event.event_type === "unsupported_claim_blocks_confidence"));
  assert.ok(layer.timeline.some((event) => event.event_type === "export_completed"));
  assert.ok(layer.timeline.some((event) => event.event_type === "share_viewed"));
});

