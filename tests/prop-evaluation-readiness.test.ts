import assert from "node:assert/strict";
import test from "node:test";

import { computePropEvaluationReadiness } from "../src/lib/server/prop-evaluation/prop-evaluation-service";

const baseArtifact = {
  artifact_id: "artifact-prop-test",
  artifact_type: "generic_trade_csv",
  artifact_kind: "trade_csv",
  richness: "trade_only",
  parser_notes: [],
  validation: { valid: true, errors: [] },
};

test("prop evaluation uses runtime rules and does not pass a negative profit target", () => {
  const diagnostic = computePropEvaluationReadiness({
    ...baseArtifact,
    trades: [
      { entry_time: "2026-01-01T00:00:00Z", exit_time: "2026-01-01T01:00:00Z", side: "long", entry_price: 100, exit_price: 100, quantity: 1, pnl: -65_247.29 },
    ],
  } as any, {
    schema_version: "prop_evaluation_rules_v1",
    source: "runtime",
    label: "Runtime challenge",
    account_size: 100_000,
    profit_target_pct: 0.08,
    max_total_drawdown_pct: 0.10,
    max_daily_loss_pct: 0.05,
    minimum_trading_days: 1,
    maximum_evaluation_days: 30,
  });

  const profitTarget = diagnostic.rule_status.find((row) => row.rule === "profit_target");
  const totalDrawdown = diagnostic.rule_status.find((row) => row.rule === "max_total_drawdown");
  const dailyLoss = diagnostic.rule_status.find((row) => row.rule === "max_daily_loss");

  assert.equal(diagnostic.status, "available");
  assert.equal(diagnostic.rule_snapshot.source, "runtime");
  assert.equal(profitTarget?.status, "fail");
  assert.equal(profitTarget?.observed, -65.2473);
  assert.equal(profitTarget?.allowed, 8);
  assert.equal(totalDrawdown?.status, "fail");
  assert.equal(dailyLoss?.status, "fail");
});

test("prop evaluation marks consistency limited on losing paths instead of pass", () => {
  const diagnostic = computePropEvaluationReadiness({
    ...baseArtifact,
    trades: [
      { exit_time: "2026-01-01T00:00:00Z", side: "long", entry_price: 100, exit_price: 100, quantity: 1, pnl: -2_000 },
      { exit_time: "2026-01-02T00:00:00Z", side: "long", entry_price: 100, exit_price: 100, quantity: 1, pnl: -1_000 },
    ],
  } as any, {
    schema_version: "prop_evaluation_rules_v1",
    source: "runtime",
    label: "Runtime challenge",
    account_size: 100_000,
    profit_target_pct: 0.08,
    max_total_drawdown_pct: 0.10,
    max_daily_loss_pct: 0.05,
    minimum_trading_days: 1,
    maximum_evaluation_days: 30,
    consistency_max_day_profit_pct: 0.35,
  });

  const consistency = diagnostic.rule_status.find((row) => row.rule === "consistency_max_day_profit");
  assert.equal(consistency?.status, "limited");
  assert.equal(consistency?.observed, null);
  assert.equal(consistency?.allowed, 35);
});

test("runtime risk per trade unlocks scaled risk sensitivity without per-trade R", () => {
  const diagnostic = computePropEvaluationReadiness({
    ...baseArtifact,
    trades: [
      { exit_time: "2026-01-01T00:00:00Z", side: "long", entry_price: 100, exit_price: 100, quantity: 1, pnl: 2_000 },
      { exit_time: "2026-01-02T00:00:00Z", side: "long", entry_price: 100, exit_price: 100, quantity: 1, pnl: -1_000 },
      { exit_time: "2026-01-03T00:00:00Z", side: "long", entry_price: 100, exit_price: 100, quantity: 1, pnl: 3_000 },
    ],
  } as any, {
    schema_version: "prop_evaluation_rules_v1",
    source: "runtime",
    label: "Runtime challenge",
    account_size: 100_000,
    profit_target_pct: 0.08,
    max_total_drawdown_pct: 0.10,
    max_daily_loss_pct: 0.05,
    minimum_trading_days: 1,
    maximum_evaluation_days: 30,
  }, {
    account_size: 100_000,
    risk_per_trade_pct: 1,
  });

  const riskSensitivity = diagnostic.metadata?.risk_sensitivity as Record<string, any>;
  assert.equal(riskSensitivity.status, "runtime_risk_scaled");
  assert.equal(riskSensitivity.rows.length, 6);
  assert.equal(diagnostic.metadata?.data_quality_check && (diagnostic.metadata.data_quality_check as Record<string, unknown>).has_risk_sizing_fields, true);
});

test("prop evaluation emits rolling windows for target-before-breach and breach-before-target periods", () => {
  const diagnostic = computePropEvaluationReadiness({
    ...baseArtifact,
    trades: [
      { exit_time: "2026-01-01T00:00:00Z", side: "long", entry_price: 100, exit_price: 100, quantity: 1, pnl: 4_000 },
      { exit_time: "2026-01-02T00:00:00Z", side: "long", entry_price: 100, exit_price: 100, quantity: 1, pnl: 4_500 },
      { exit_time: "2026-01-03T00:00:00Z", side: "long", entry_price: 100, exit_price: 100, quantity: 1, pnl: -12_000 },
      { exit_time: "2026-01-04T00:00:00Z", side: "long", entry_price: 100, exit_price: 100, quantity: 1, pnl: 9_000 },
    ],
  } as any, {
    schema_version: "prop_evaluation_rules_v1",
    source: "runtime",
    label: "Runtime challenge",
    account_size: 100_000,
    profit_target_pct: 0.08,
    max_total_drawdown_pct: 0.10,
    max_daily_loss_pct: 0.05,
    minimum_trading_days: 1,
    maximum_evaluation_days: 2,
  });

  const targetProgress = diagnostic.target_progress ?? {};
  const windows = diagnostic.metadata?.evaluation_windows as Array<Record<string, unknown>>;

  assert.equal(targetProgress.target_before_breach_count, 2);
  assert.equal(targetProgress.breach_before_target_count, 2);
  assert.equal(windows.some((window) => window.outcome === "target_before_breach"), true);
  assert.equal(windows.some((window) => window.outcome === "breach_before_target"), true);
});

test("target-before-breach windows expose the target event even when a later breach occurs", () => {
  const diagnostic = computePropEvaluationReadiness({
    ...baseArtifact,
    trades: [
      { exit_time: "2026-01-01T00:00:00Z", side: "long", entry_price: 100, exit_price: 100, quantity: 1, pnl: 9_000 },
      { exit_time: "2026-01-02T00:00:00Z", side: "long", entry_price: 100, exit_price: 100, quantity: 1, pnl: -12_000 },
    ],
  } as any, {
    schema_version: "prop_evaluation_rules_v1",
    source: "runtime",
    label: "Runtime challenge",
    account_size: 100_000,
    profit_target_pct: 0.08,
    max_total_drawdown_pct: 0.10,
    max_daily_loss_pct: 0.05,
    minimum_trading_days: 1,
    maximum_evaluation_days: 2,
  });

  const windows = diagnostic.metadata?.evaluation_windows as Array<Record<string, unknown>>;
  const firstWindow = windows[0];

  assert.equal(firstWindow.outcome, "target_before_breach");
  assert.equal(firstWindow.target_hit_day, "2026-01-01");
  assert.equal(firstWindow.target_hit_profit, 9000);
  assert.equal(firstWindow.breach_rule, "max_daily_loss");
  assert.equal(diagnostic.target_progress?.ending_profit, -3000);
  assert.equal(diagnostic.target_progress?.peak_profit, 9000);
});

test("prop evaluation emits survival stress, evidence grade, and decision metadata", () => {
  const diagnostic = computePropEvaluationReadiness({
    ...baseArtifact,
    trades: [
      { exit_time: "2026-01-01T12:00:00Z", side: "long", entry_price: 100, exit_price: 100, quantity: 100, pnl: 4_000 },
      { exit_time: "2026-01-02T12:00:00Z", side: "long", entry_price: 100, exit_price: 100, quantity: 100, pnl: 5_000 },
      { exit_time: "2026-01-03T12:00:00Z", side: "long", entry_price: 100, exit_price: 100, quantity: 100, pnl: -2_000 },
    ],
    equity_curve: [
      { timestamp: "2026-01-01T09:00:00Z", equity: 100_000 },
      { timestamp: "2026-01-01T12:00:00Z", equity: 104_000 },
      { timestamp: "2026-01-02T09:00:00Z", equity: 104_000 },
      { timestamp: "2026-01-02T12:00:00Z", equity: 109_000 },
    ],
    broker_exports: [
      { timestamp: "2026-01-01T12:00:00Z", fee: 4.25, liquidity: "taker" },
      { timestamp: "2026-01-02T12:00:00Z", fee: 4.5, liquidity: "maker" },
    ],
  } as any, {
    schema_version: "prop_evaluation_rules_v1",
    source: "runtime",
    label: "Runtime challenge",
    account_size: 100_000,
    profit_target_pct: 0.08,
    max_total_drawdown_pct: 0.10,
    max_daily_loss_pct: 0.05,
    minimum_trading_days: 1,
    maximum_evaluation_days: 3,
  });

  const metadata = diagnostic.metadata ?? {};
  const stress = metadata.stress_test as Record<string, any>;
  const monteCarlo = metadata.prop_monte_carlo as Record<string, any>;
  const evidence = metadata.evidence_grade as Record<string, any>;
  const decision = metadata.decision_card as Record<string, any>;

  assert.equal(Array.isArray(stress.scenarios), true);
  assert.equal(stress.scenarios.length, 5);
  assert.equal(typeof monteCarlo.target_before_breach_probability, "number");
  assert.equal(monteCarlo.iterations, 1000);
  assert.equal(evidence.equity.quality, "equity_curve_backed");
  assert.equal(evidence.broker.quality, "broker_context_available");
  assert.ok(["challenge_ready_with_caveats", "conditional", "not_ready", "needs_more_edge"].includes(decision.readiness));
});
