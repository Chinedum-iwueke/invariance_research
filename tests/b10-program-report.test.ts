import assert from "node:assert/strict";
import test from "node:test";
import type { ProgramReportSnapshot } from "../src/lib/server/research-programs/models";
import { renderProgramReport } from "../src/lib/server/research-programs/program-report-service";

const report: ProgramReportSnapshot = {
  program_report_snapshot_id: "program-report-1",
  program_id: "program-1",
  account_id: "account-1",
  title: "Momentum research milestone",
  status: "active",
  created_at: "2026-06-13T00:00:00.000Z",
  payload: {
    schema_version: "program_report_snapshot_v1",
    program_id: "program-1",
    title: "Momentum research milestone",
    generated_at: "2026-06-13T00:00:00.000Z",
    research_question: {
      thesis: "Breakout momentum persists after volatility compression.",
      market: "crypto",
      asset_universe: "BTC, ETH",
      timeframe: "1h",
    },
    hypotheses_tested: [{
      hypothesis_version_id: "hypothesis-version-1",
      title: "Volatility compression breakout",
      thesis: "Compression predicts continuation.",
      status: "approved_for_strategy_generation",
      invalidation_criteria: ["No holdout persistence"],
      required_datasets: ["ohlcv"],
    }],
    experiments_run: [{
      experiment_job_id: "job-1",
      status: "completed",
      current_step: "completed",
      progress_pct: 100,
      verdict: "promising_but_under_supported",
      confidence: "medium",
      decision_grade: false,
      recommended_action: "run_holdout",
      artifact_summary: { card_bundle: "s3://artifact/cards.json" },
      created_at: "2026-06-13T00:00:00.000Z",
      finished_at: "2026-06-13T00:10:00.000Z",
    }],
    rejected_variants: [{ title: "Run job-fail", reason: "Execution drag erased edge.", evidence: { rule: "cost_sensitivity" } }],
    surviving_candidates: [{ title: "Run job-1", support: "promising but under-supported", evidence: { confidence: "medium" } }],
    evidence_limits: ["No broker-level execution data supplied."],
    next_experiment_plan: ["Run holdout split."],
    memory_summary: {
      items: 1,
      findings: [{ headline: "Cost drag", detail: "Costs reduce edge.", severity: "warning" }],
      recommendations: [{ recommendation: "Run holdout split.", status: "proposed", confidence: 0.7 }],
      similar_signatures: ["cost_drag:medium"],
    },
    imports: [{
      analysis_id: "analysis-1",
      strategy_name: "Audit import",
      status: "completed",
      trade_count: 100,
      robustness_score: "60",
    }],
    research_desk_packet: {
      hypothesis_specs: ["hypothesis-version-1"],
      strategy_specs: ["strategy-1"],
      experiment_plans: ["plan-1"],
      run_artifacts: [{ card_bundle: "s3://artifact/cards.json" }],
      verdict_cards: [{ verdict: "promising_but_under_supported" }],
      memory_summary: {
        items: 1,
        findings: [{ headline: "Cost drag", detail: "Costs reduce edge.", severity: "warning" }],
        recommendations: [{ recommendation: "Run holdout split.", status: "proposed", confidence: 0.7 }],
        similar_signatures: ["cost_drag:medium"],
      },
    },
    redaction_policy: {
      policy_version: "program_share_room_redaction_v1",
      public_share_excludes: ["raw engine artifacts"],
      public_share_includes: ["research question", "hypotheses tested"],
      raw_artifacts_public: false,
      pii_exposure: "none",
    },
  },
};

test("B10 program report renders a reasoning-path markdown artifact", () => {
  const rendered = renderProgramReport(report, "md");
  const markdown = Buffer.from(rendered.bytes).toString("utf8");
  assert.equal(rendered.content_type, "text/markdown; charset=utf-8");
  assert.match(markdown, /## Research Question/);
  assert.match(markdown, /## Hypotheses Tested/);
  assert.match(markdown, /## Experiments Run/);
  assert.match(markdown, /## Rejected Variants/);
  assert.match(markdown, /## Surviving Candidates/);
  assert.match(markdown, /## Evidence Limits/);
  assert.match(markdown, /## Next Experiment Plan/);
});

test("B10 program report JSON preserves the Research Desk handoff packet", () => {
  const rendered = renderProgramReport(report, "json");
  const payload = JSON.parse(Buffer.from(rendered.bytes).toString("utf8")) as ProgramReportSnapshot["payload"];
  assert.equal(rendered.content_type, "application/json; charset=utf-8");
  assert.equal(payload.schema_version, "program_report_snapshot_v1");
  assert.deepEqual(payload.research_desk_packet.hypothesis_specs, ["hypothesis-version-1"]);
  assert.deepEqual(payload.research_desk_packet.strategy_specs, ["strategy-1"]);
  assert.equal(payload.research_desk_packet.verdict_cards.length, 1);
  assert.equal(payload.redaction_policy.raw_artifacts_public, false);
});
