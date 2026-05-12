import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "invariance-report-intel-"));
process.env.INVARIANCE_DB_PATH = path.join(tempDir, "test.sqlite");
process.env.DATABASE_PROVIDER = "sqlite";

import { buildTruthContext } from "../src/lib/app/context-truth";
import { mapDeploymentReadinessStatus, deriveReportVerdict } from "../src/lib/app/report-view";
import {
  buildDiagnosticInsightContext,
  generateLlmInsightsForRecord,
  mergeLlmInsightResult,
  validateLlmInsights,
} from "../src/lib/server/llm-insights";
import { createWaitlistEntry, listWaitlistEntries } from "../src/lib/server/waitlist/repository";
import { closeDbForTests } from "../src/lib/server/persistence/database";
import type { AnalysisRecord, LlmDiagnosticInsights } from "../src/lib/contracts/index";

function record(overrides: Partial<AnalysisRecord> = {}): AnalysisRecord {
  const base = {
    analysis_id: "analysis-intel-1",
    status: "completed",
    created_at: "2026-05-11T00:00:00.000Z",
    updated_at: "2026-05-11T00:00:00.000Z",
    strategy: { strategy_name: "Test Strategy", symbols: ["SPY"], source_type: "upload" },
    dataset: { trade_count: 100 },
    run_context: { execution_model: "proxy", monte_carlo: "bootstrap", risk_model: "fixed" },
    summary: {
      headline_verdict: { status: "moderate", title: "Conditional validation profile", summary: "Risk remains bounded but incomplete." },
      short_summary: "Conditional profile.",
      key_findings: [],
      warnings: [],
    },
    diagnostics: {
      overview: {
        metrics: [{ label: "Win Rate", value: "55.0%", band: "moderate" }],
        figure: { figure_id: "overview", title: "Overview", type: "line", series: [] },
        interpretation: { title: "Overview", summary: "Overview summary." },
        verdict: { status: "moderate", title: "Conditional", summary: "Conditional." },
        recommendations: [
          "Include OHLCV or regime labels to unlock conditional analysis.",
          "Validate live execution slippage before scaling.",
          "Validate live execution slippage before scaling.",
        ],
      },
      distribution: {
        metrics: [{ label: "Expectancy", value: "0.20", band: "moderate" }],
        figures: [],
        interpretation: { title: "Distribution", summary: "Distribution summary." },
        recommendations: ["Include OHLCV or regime labels to unlock conditional analysis.", "Inspect payoff concentration."],
      },
      monte_carlo: {
        metrics: [
          { label: "P(Ruin)", value: "3.0%", band: "moderate" },
          { label: "95th Percentile Drawdown", value: "18.0%", band: "moderate" },
        ],
        figure: { figure_id: "mc", title: "MC", type: "line", series: [] },
        interpretation: { title: "MC", summary: "MC summary." },
        warnings: [],
        recommendations: ["Size capital buffers against p95 drawdown."],
      },
      stability: { metrics: [], interpretation: { title: "Stability", summary: "" }, locked: true },
      execution: { metrics: [], scenarios: [], interpretation: { title: "Execution", summary: "" }, recommendations: [] },
      regimes: { metrics: [], regime_metrics: [], interpretation: { title: "Regimes", summary: "" }, locked: true },
      ruin: { metrics: [{ label: "Probability of Ruin", value: "3.0%", band: "moderate" }], assumptions: [], interpretation: { title: "Ruin", summary: "" }, recommendations: [] },
    },
    engine_payload: {
      summary_metrics: [],
      diagnostics: {
        overview: { status: "available", summary_metrics: [], figures: [], assumptions: [], warnings: [], recommendations: [], limitations: [] },
      },
      report_sections: { assumptions: [], limitations: [], recommendations: [] },
      raw_result: {},
    },
    report: {
      report_id: "report-1",
      executive_summary: "Report summary.",
      diagnostics_summary: [],
      methodology_assumptions: [],
      limitations: [],
      recommendations: ["Validate live execution slippage before scaling."],
      deployment_guidance: [],
      figures: [],
      source: "summary_fallback",
      export_ready: false,
    },
    access: { can_view_stability: false, can_view_regimes: false, can_view_ruin: true, can_export_report: false },
    diagnostic_statuses: {
      overview: { status: "available", available: true, limited: false, unavailable: false, skipped: false },
      distribution: { status: "available", available: true, limited: false, unavailable: false, skipped: false },
      monte_carlo: { status: "available", available: true, limited: false, unavailable: false, skipped: false },
      stability: { status: "skipped", available: false, limited: false, unavailable: false, skipped: true },
      execution: { status: "limited", available: false, limited: true, unavailable: false, skipped: false },
      regimes: { status: "skipped", available: false, limited: false, unavailable: false, skipped: true },
      ruin: { status: "available", available: true, limited: false, unavailable: false, skipped: false },
      report: { status: "limited", available: false, limited: true, unavailable: false, skipped: false },
    },
  } as AnalysisRecord;

  return { ...base, ...overrides } as AnalysisRecord;
}

function validInsights(): LlmDiagnosticInsights {
  return {
    overview_interpretation: "Core diagnostics are conditional and should be read with execution limits.",
    distribution_interpretation: "Expectancy is positive but payoff concentration should be checked.",
    monte_carlo_interpretation: "Path risk is driven by p95 drawdown rather than the median path.",
    execution_interpretation: "Execution context is limited, so cost sensitivity remains a gating check.",
    ruin_interpretation: "Ruin estimate is moderate under current sizing assumptions.",
    final_verdict: "Conditional validation profile with further execution and path-risk checks required.",
    deployment_readiness: {
      status: "conditional",
      headline: "Further validation is required before scaling.",
      rationale: "Core metrics are present, but diagnostic coverage is incomplete.",
      next_actions: ["Validate live execution costs.", "Size against p95 drawdown."],
    },
    recommendations_by_page: {
      overview: ["Resolve deployment blockers before scaling."],
      distribution: ["Inspect payoff concentration."],
      monte_carlo: ["Size capital buffer against p95 drawdown."],
      execution: ["Compare live costs with stressed assumptions."],
      ruin: ["Reduce risk per trade and re-test survivability."],
      report: ["Complete missing audit diagnostics."],
    },
  };
}

function validStructuredInsights() {
  return {
    validation_verdict: {
      summary: "Conditional validation profile with further execution and path-risk checks required.",
      strengths: ["Core diagnostics are present."],
      weaknesses: ["Diagnostic coverage is incomplete."],
      benchmark_context: "Benchmark context should be interpreted only if configured and available.",
      confidence_notes: "Confidence is moderate because execution and audit depth remain incomplete.",
    },
    deployment_readiness_assessment: {
      summary: "Further validation is required before scaling.",
      deployment_risk_level: "moderate",
      readiness_status: "conditional",
      strengths: ["Ruin estimate is moderate under current sizing."],
      blockers: ["Execution assumptions require live validation."],
      next_experiments: ["Validate live execution costs.", "Size against p95 drawdown."],
      confidence_notes: "Core metrics are present, but diagnostic coverage is incomplete.",
    },
    recommendation_bundle: {
      summary: "Prioritize execution validation and capital buffer sizing.",
      overview: ["Resolve deployment blockers before scaling."],
      distribution: ["Inspect payoff concentration."],
      monte_carlo: ["Size capital buffer against p95 drawdown."],
      execution: ["Compare live costs with stressed assumptions."],
      ruin: ["Reduce risk per trade and re-test survivability."],
      report: ["Complete missing audit diagnostics."],
    },
    execution_interpretation_detail: {
      summary: "Execution context is limited, so cost sensitivity remains a gating check.",
      execution_warnings: ["Live cost drift could impair expectancy."],
      fee_sensitivity: "Fee sensitivity requires live comparison against stressed assumptions.",
      fragility_signals: ["Limited execution context."],
      next_experiments: ["Compare live costs with modeled stress."],
    },
    distribution_interpretation_detail: {
      summary: "Expectancy is positive but payoff concentration should be checked.",
      strengths: ["Positive expectancy."],
      weaknesses: ["Payoff concentration may dominate average outcome."],
      fragility_signals: ["Tail dependence should be inspected."],
      next_experiments: ["Segment winners and losers by magnitude."],
    },
    monte_carlo_interpretation_detail: {
      summary: "Path risk is driven by p95 drawdown rather than the median path.",
      fragility_signals: ["p95 drawdown drives sizing constraints."],
      regime_dependency: "Regime dependency is not established without available regime diagnostics.",
      next_experiments: ["Repeat with regime-aware assumptions when available."],
      confidence_notes: "Simulation interpretation depends on emitted path assumptions.",
    },
    risk_of_ruin_interpretation: {
      summary: "Ruin estimate is moderate under current sizing assumptions.",
      fragility_signals: ["Ruin should be re-tested after sizing changes."],
      deployment_risk_level: "moderate",
      next_experiments: ["Re-test survivability after reducing risk per trade."],
      confidence_notes: "Ruin interpretation is bounded by current sizing assumptions.",
    },
  };
}

test.after(() => {
  closeDbForTests();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("benchmark recommendation appears only if benchmark is absent", () => {
  const withBenchmark = record({
    engine_payload: {
      ...record().engine_payload,
      diagnostics: {
        overview: {
          status: "available",
          summary_metrics: [],
          figures: [],
          assumptions: [],
          warnings: [],
          recommendations: [],
          limitations: [],
          benchmark_comparison: { reason: "available", status: "available", metadata: { benchmark_id: "SPY" } },
        },
      },
    },
  });

  assert.equal(buildTruthContext(withBenchmark, "overview", { benchmark: { enabled: true } as never }).recommendations.some((item) => /configure a benchmark|benchmark-compatible/i.test(item)), false);
  assert.equal(buildTruthContext(record(), "overview").recommendations.some((item) => /configure a benchmark|benchmark-compatible/i.test(item)), true);
});

test("duplicate and audit-level recommendations are deduplicated away from diagnostic pages", () => {
  const overview = buildTruthContext(record(), "overview").recommendations;
  const distribution = buildTruthContext(record(), "distribution").recommendations;

  assert.equal(new Set(overview.map((item) => item.toLowerCase())).size, overview.length);
  assert.equal(distribution.some((item) => /ohlcv|regime labels|parameter sweep/i.test(item)), false);
  assert.equal(distribution.some((item) => /payoff concentration/i.test(item)), true);
});

test("Ollama unavailable falls back without throwing and persists fallback status", async () => {
  const previousFetch = globalThis.fetch;
  process.env.LLM_INSIGHTS_ENABLED = "true";
  process.env.LLM_PROVIDER = "ollama";
  globalThis.fetch = (() => Promise.reject(new Error("connection refused"))) as typeof fetch;
  const result = await generateLlmInsightsForRecord(record());
  const merged = mergeLlmInsightResult(record(), result);
  assert.equal(result.status, "fallback");
  assert.equal(merged.llm_insights, undefined);
  assert.equal(merged.llm_insights_status, "fallback");
  globalThis.fetch = previousFetch;
  delete process.env.LLM_INSIGHTS_ENABLED;
});

test("invalid LLM JSON falls back through invalid status", async () => {
  const previousFetch = globalThis.fetch;
  process.env.LLM_INSIGHTS_ENABLED = "true";
  process.env.LLM_PROVIDER = "ollama";
  globalThis.fetch = (async () => new Response(JSON.stringify({ response: "{not-json" }), { status: 200 })) as typeof fetch;
  const result = await generateLlmInsightsForRecord(record());
  assert.equal(result.status, "fallback");
  assert.match(result.error ?? "", /json|unexpected|position/i);
  globalThis.fetch = previousFetch;
  delete process.env.LLM_INSIGHTS_ENABLED;
});

test("Ollama request defaults to llama3.1:8b and caps prompt at 7kb", async () => {
  const previousFetch = globalThis.fetch;
  process.env.LLM_INSIGHTS_ENABLED = "true";
  process.env.LLM_PROVIDER = "ollama";
  delete process.env.OLLAMA_MODEL;

  let requestBody: { model?: string; messages?: Array<{ content?: string }> } | undefined;
  globalThis.fetch = (async (_input, init) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ message: { content: JSON.stringify(validStructuredInsights()) } }), { status: 200 });
  }) as typeof fetch;

  const result = await generateLlmInsightsForRecord(record({
    report: {
      ...record().report,
      limitations: Array.from({ length: 50 }, (_, index) => `Long deterministic limitation ${index}: ${"x".repeat(220)}`),
      recommendations: Array.from({ length: 50 }, (_, index) => `Long deterministic recommendation ${index}: ${"y".repeat(220)}`),
    },
  }));

  assert.equal(result.status, "generated");
  assert.equal(requestBody?.model, "llama3.1:8b");
  assert.ok((requestBody?.messages?.[0]?.content?.length ?? Infinity) <= 7 * 1024);

  globalThis.fetch = previousFetch;
  delete process.env.LLM_INSIGHTS_ENABLED;
});

test("LLM output schema validation rejects contradictions and accepts valid output", () => {
  const context = buildDiagnosticInsightContext(record(), { enabled: true, resolved_id: "SPY" } as never);
  assert.ok(validateLlmInsights(validInsights(), context));

  const invalid = validInsights();
  invalid.recommendations_by_page.overview = ["Provide benchmark config context before using relative-performance claims."];
  assert.equal(validateLlmInsights(invalid, context), undefined);
});

test("deployment readiness status mapping respects deterministic risk", () => {
  const fragile = record({
    summary: {
      ...record().summary,
      headline_verdict: { status: "fragile", title: "Fragile", summary: "Fragile under stress." },
    },
  });
  assert.equal(mapDeploymentReadinessStatus(fragile, deriveReportVerdict(fragile)), "not_advisable");

  const withLlm = record({ llm_insights: validInsights() });
  assert.equal(mapDeploymentReadinessStatus(withLlm, deriveReportVerdict(withLlm)), "conditional");
});

test("report waitlist form path stores source_page=validation_report", () => {
  createWaitlistEntry({ email: "desk@example.com", name: "Desk User", sourcePage: "validation_report" });
  const entries = listWaitlistEntries();
  assert.equal(entries[0].source_page, "validation_report");
  assert.equal(entries[0].name, "Desk User");
});
