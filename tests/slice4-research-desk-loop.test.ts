import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "invariance-slice4-research-desk-"));
process.env.INVARIANCE_DB_PATH = path.join(tempDir, "test.sqlite");
process.env.INVARIANCE_STORAGE_ROOT = path.join(tempDir, "storage");

import type { AnalysisRecord } from "../src/lib/contracts";
import { accountService } from "../src/lib/server/accounts/service";
import { analysisRepository } from "../src/lib/server/repositories/analysis-repository";
import { artifactRepository } from "../src/lib/server/repositories/artifact-repository";
import { closeDbForTests, getDb } from "../src/lib/server/persistence/database";
import { evidenceEventRepository } from "../src/lib/server/evidence/evidence-events";
import { researchDeskRepository } from "../src/lib/server/repositories/research-desk-repository";
import { buildResearchDeskTimeline, createResearchDeskRequest, updateResearchDeskRequest } from "../src/lib/server/research-desk/research-desk-service";

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
    DELETE FROM accounts;
    DELETE FROM users;
  `);
}

function analysisRecord(analysisId: string, limitation = "Execution assumptions are limited."): AnalysisRecord {
  return {
    analysis_id: analysisId,
    status: "completed",
    created_at: "2026-05-15T00:00:00.000Z",
    updated_at: "2026-05-15T00:00:00.000Z",
    strategy: { strategy_name: "Research Desk Strategy", symbols: ["BTC"], source_type: "upload", timeframe: "1H" },
    dataset: { trade_count: 42, market: "Crypto", start_date: "2026-01-01", end_date: "2026-04-01" },
    run_context: { execution_model: "proxy", monte_carlo: "bootstrap", risk_model: "fixed" },
    summary: {
      headline_verdict: { status: "moderate", title: "Conditional", summary: "The strategy needs deeper validation." },
      short_summary: "Conditional strategy.",
      key_findings: ["Core trade profile is visible."],
      warnings: [{ code: "LIMITED_EXECUTION", severity: "warning", title: "Limited execution", message: limitation }],
    },
    diagnostics: {
      overview: { metrics: [{ label: "Net return", value: "18%", band: "good" }], interpretation: { title: "Overview", summary: "Overview." }, verdict: { status: "moderate", title: "Conditional", summary: "Conditional." } },
      distribution: { metrics: [], figures: [], interpretation: { title: "Distribution", summary: "Distribution." } },
      monte_carlo: { metrics: [], figure: { figure_id: "mc", title: "Monte Carlo", type: "line", series: [] }, interpretation: { title: "Monte Carlo", summary: "Path risk." }, warnings: [], recommendations: [] },
      stability: { metrics: [], interpretation: { title: "Stability", summary: "" }, locked: true },
      execution: { metrics: [], scenarios: [], interpretation: { title: "Execution", summary: "" }, recommendations: ["Validate live slippage."], limitations: [limitation] },
      regimes: { metrics: [], regime_metrics: [], interpretation: { title: "Regimes", summary: "" }, locked: true },
      ruin: { metrics: [], assumptions: [], interpretation: { title: "Ruin", summary: "" }, recommendations: [] },
    },
    engine_payload: {
      summary_metrics: [],
      diagnostics: { overview: { status: "available", summary_metrics: [], figures: [], assumptions: [], warnings: [], recommendations: [], limitations: [] } },
      report_sections: { assumptions: [], limitations: [limitation], recommendations: ["Validate live slippage."] },
      raw_result: {},
    },
    report: {
      report_id: `report-${analysisId}`,
      executive_summary: "Conditional validation report.",
      diagnostics_summary: ["Overview available."],
      methodology_assumptions: ["artifact_richness=trade_only"],
      limitations: [limitation],
      recommendations: ["Validate live slippage."],
      deployment_guidance: ["Request deeper execution review."],
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
      execution: { status: "limited", available: false, limited: true, unavailable: false, skipped: false, reason: limitation },
      regimes: { status: "skipped", available: false, limited: false, unavailable: false, skipped: true, reason: "OHLCV missing." },
      ruin: { status: "available", available: true, limited: false, unavailable: false, skipped: false },
      report: { status: "limited", available: false, limited: true, unavailable: false, skipped: false, reason: "Report includes limitations." },
    },
  } as AnalysisRecord;
}

async function seedAnalysis(index: number, limitation = "Execution assumptions are limited.") {
  const { user, account } = await accountService.ensureUserAndAccount({ email: `slice4-${index}@example.com` });
  await accountService.applySubscription({ account_id: account.account_id, provider_customer_id: `cus-slice4-${index}`, provider_subscription_id: `sub-slice4-${index}`, plan_id: "pro", status: "active" });
  const artifactId = `artifact-slice4-${index}`;
  const record = analysisRecord(`analysis-slice4-${index}`, limitation);
  artifactRepository.save({
    artifact_id: artifactId,
    owner_user_id: user.user_id,
    account_id: account.account_id,
    file_name: "trades.csv",
    file_type: "text/csv",
    file_size_bytes: 128,
    storage_key: `uploads/slice4/${artifactId}.csv`,
    checksum_sha256: `checksum-${index}`,
    artifact_kind: "trade_csv",
    richness: "trade_only",
    uploaded_at: record.created_at,
    parsed_artifact: {
      artifact_kind: "trade_csv",
      artifact_type: "trade_csv",
      richness: "trade_only",
      strategy_metadata: { strategy_name: record.strategy.strategy_name },
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
      diagnostics_limited: ["execution"],
      diagnostics_unavailable: ["stability", "regimes"],
      limitation_reasons: [limitation],
      parser_notes: [],
      summary_text: "Trade CSV accepted with execution limits.",
    },
  });
  analysisRepository.save({
    analysis_id: record.analysis_id,
    owner_user_id: user.user_id,
    account_id: account.account_id,
    status: "completed",
    artifact_id: artifactId,
    created_at: record.created_at,
    updated_at: record.updated_at,
    result: record,
    eligibility_snapshot: artifactRepository.findById(artifactId)?.eligibility_summary,
  });
  return { user, account, record };
}

test.beforeEach(() => resetDb());
test.after(() => {
  closeDbForTests();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("research desk requests are linked to the exact report artifact, analysis, and limitation", async () => {
  const { user, account, record } = await seedAnalysis(1);
  const { request, learning_event } = await createResearchDeskRequest({
    analysis_id: record.analysis_id,
    account_id: account.account_id,
    requested_by_user_id: user.user_id,
    trigger_limitation: "Execution assumptions are limited.",
    requested_services: ["execution_audit", "data_quality_audit", "benchmark_construction"],
    user_note: "Need to decide whether this can paper trade.",
  });

  assert.equal(request.analysis_id, record.analysis_id);
  assert.equal(request.artifact_id, "artifact-slice4-1");
  assert.equal(request.trigger_limitation, "Execution assumptions are limited.");
  assert.equal(request.validation_packet.report_snapshot_id, request.report_snapshot_id);
  assert.equal(request.validation_packet.requested_services.includes("execution_audit"), true);
  assert.equal(request.validation_packet.requested_services.includes("data_quality_audit"), true);
  assert.equal(request.validation_packet.limitations.includes("Execution assumptions are limited."), true);
  assert.equal(request.validation_packet.artifact_manifest.artifact_id, "artifact-slice4-1");
  assert.ok(request.validation_packet.evidence_ledger.length > 0);
  assert.ok(request.validation_packet.requested_questions.length > 0);
  assert.ok(request.validation_packet.reviewer_checklist.length > 0);
  assert.equal(learning_event.promotion_candidate, false);
});

test("reviewer addenda are tied back to the request and can approve report context", async () => {
  const { user, account, record } = await seedAnalysis(2);
  const { request } = await createResearchDeskRequest({
    analysis_id: record.analysis_id,
    account_id: account.account_id,
    requested_by_user_id: user.user_id,
    trigger_limitation: "Execution assumptions are limited.",
  });

  const updated = await updateResearchDeskRequest({
    request_id: request.request_id,
    reviewer_user_id: user.user_id,
    status: "in_review",
    addendum_status: "approved",
    internal_note: "User needs execution proof before capital allocation.",
    public_addendum: "Reviewer recommends a 30-day live slippage audit before scaling.",
  });

  assert.equal(updated.request.status, "approved");
  assert.equal(updated.addendum?.report_snapshot_id, request.report_snapshot_id);
  assert.equal(updated.addendum?.status, "approved");
  assert.equal(updated.addendum?.public_addendum, "Reviewer recommends a 30-day live slippage audit before scaling.");
  const timeline = buildResearchDeskTimeline(updated.request, updated.addendum);
  assert.deepEqual(timeline.map((event) => event.status), ["received", "scoped", "quoted", "in_review", "addendum_draft", "approved", "delivered", "closed"]);
  assert.equal(timeline.find((event) => event.status === "approved")?.state, "current");

  const eventTypes = evidenceEventRepository.listByAnalysis(record.analysis_id).map((event) => event.event_type);
  assert.ok(eventTypes.includes("research_desk_status_updated"));
  assert.ok(eventTypes.includes("research_desk_addendum_approved"));
});

test("learning events only become promotion candidates after repeated evidence", async () => {
  const limitation = "OHLCV missing prevents regime validation.";
  const events = [];
  for (let index = 3; index <= 5; index += 1) {
    const { user, account, record } = await seedAnalysis(index, limitation);
    const { learning_event } = await createResearchDeskRequest({
      analysis_id: record.analysis_id,
      account_id: account.account_id,
      requested_by_user_id: user.user_id,
      trigger_limitation: limitation,
    });
    events.push(learning_event);
  }

  assert.equal(events[0].evidence_count, 1);
  assert.equal(events[1].promotion_candidate, false);
  assert.equal(events[2].evidence_count, 3);
  assert.equal(events[2].promotion_candidate, true);
  assert.equal((await researchDeskRepository.listLearningEvents(events[2].learning_key)).length, 3);
});
