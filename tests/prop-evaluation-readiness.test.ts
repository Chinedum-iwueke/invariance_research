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
