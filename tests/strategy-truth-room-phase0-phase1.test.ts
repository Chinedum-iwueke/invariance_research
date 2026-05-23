import assert from "node:assert/strict";
import test from "node:test";

import {
  STRATEGY_TRUTH_ROOM_ARTIFACT_FAMILIES,
  STRATEGY_TRUTH_ROOM_CONTRACT_VERSION,
  STRATEGY_TRUTH_ROOM_EVIDENCE_STATES,
  STRATEGY_TRUTH_ROOM_VERDICTS,
} from "../src/lib/contracts/strategy-truth-room";
import { genericBundleV1ParserAdapter } from "../src/lib/server/ingestion/parsers/generic-bundle-v1";
import { validateBundleV1 } from "../src/lib/server/ingestion/validators/bundle";

const tradesCsv = [
  "trade_id,symbol,side,entry_time,exit_time,entry_price,exit_price,quantity,fees,pnl,risk_amount,market,exchange",
  "t1,BTCUSDT,long,2026-01-01T00:00:00Z,2026-01-01T01:00:00Z,100,103,1,0.1,2.9,100,crypto,binance",
  "t2,BTCUSDT,short,2026-01-02T00:00:00Z,2026-01-02T01:00:00Z,104,101,1,0.1,2.9,100,crypto,binance",
].join("\n");

const manifest = {
  schema_version: "1.0",
  artifact_type: "research_bundle",
  bundle_type: "strategy_truth_room_bundle_v1",
  contract_version: STRATEGY_TRUTH_ROOM_CONTRACT_VERSION,
  strategy_name: "Phase 1 Bundle",
  source_platform: "fixture",
  included_files: [
    "manifest.json",
    "trades.csv",
    "metadata.json",
    "assumptions.json",
    "params.json",
    "parameter_results.csv",
    "run_manifest.json",
    "ohlcv.csv",
    "benchmark.csv",
    "broker_export.csv",
    "declared_claims.json",
  ],
  files: [
    { path: "trades.csv", role: "trade_log_v1", schema_version: "1.0", required: true, sha256: "fixture-trades" },
    { path: "parameter_results.csv", role: "parameter_sweep_v1", schema_version: "1.0", required: false, sha256: "fixture-params" },
    { path: "run_manifest.json", role: "parameter_sweep_v1", schema_version: "1.0", required: false, sha256: "fixture-run-manifest" },
    { path: "ohlcv.csv", role: "ohlcv_context_v1", schema_version: "1.0", required: false, sha256: "fixture-ohlcv" },
    { path: "benchmark.csv", role: "benchmark_series_v1", schema_version: "1.0", required: false, sha256: "fixture-benchmark" },
    { path: "broker_export.csv", role: "broker_export_v1", schema_version: "1.0", required: false, sha256: "fixture-broker" },
    { path: "declared_claims.json", role: "declared_claims_v1", schema_version: "1.0", required: false, sha256: "fixture-claims" },
  ],
  assumptions_present: true,
  ohlcv_present: true,
  declared_claims_present: true,
  broker_export_present: true,
  parameter_metadata_present: true,
};

test("Phase 0 Strategy Truth Room contract constants are stable", () => {
  assert.equal(STRATEGY_TRUTH_ROOM_CONTRACT_VERSION, "1.0.0");
  assert.ok(STRATEGY_TRUTH_ROOM_ARTIFACT_FAMILIES.includes("strategy_truth_room_bundle_v1"));
  assert.ok(STRATEGY_TRUTH_ROOM_ARTIFACT_FAMILIES.includes("broker_export_v1"));
  assert.ok(STRATEGY_TRUTH_ROOM_VERDICTS.includes("execution_fantasy"));
  assert.ok(STRATEGY_TRUTH_ROOM_EVIDENCE_STATES.includes("plan_locked"));
});

test("Phase 1 bundle validator accepts Strategy Truth Room manifest roles and required file checks", () => {
  const validated = validateBundleV1({
    entries: [
      { path: "manifest.json", text: JSON.stringify(manifest) },
      { path: "trades.csv", text: tradesCsv },
      { path: "metadata.json", text: JSON.stringify({ strategy_name: "Phase 1 Bundle", source_platform: "fixture" }) },
      { path: "assumptions.json", text: JSON.stringify({ commission_model: "maker/taker supplied" }) },
      { path: "params.json", text: JSON.stringify({ parameter_set_name: "base", tunable_parameters: { lookback: 20, threshold: 1.2 } }) },
      { path: "parameter_results.csv", text: "run_id,lookback,threshold,net_profit,max_drawdown,sharpe,trade_count\nrun_1,10,1.2,100,20,1.1,2\nrun_2,20,1.2,80,18,0.9,2" },
      { path: "run_manifest.json", text: JSON.stringify({ base_run_id: "run_2", parameter_names: ["lookback", "threshold"] }) },
      { path: "ohlcv.csv", text: "timestamp,open,high,low,close,volume\n2026-01-01T00:00:00Z,100,101,99,100.5,1000" },
      { path: "benchmark.csv", text: "timestamp,equity\n2026-01-01T00:00:00Z,100000" },
      { path: "broker_export.csv", text: "fill_id,symbol,price,quantity,fee\nf1,BTCUSDT,100,1,0.1" },
      { path: "declared_claims.json", text: JSON.stringify({ claims: [{ claim: "Positive expectancy after fees", priority: "high" }] }) },
    ],
  });

  assert.equal(validated.validation.valid, true);
  assert.equal(validated.manifest?.bundle_type, "strategy_truth_room_bundle_v1");
  assert.equal(validated.manifest?.files?.[0]?.role, "trade_log_v1");
});

test("Phase 1 bundle parser preserves unlock artifacts, claims, provenance, and diagnostics", async () => {
  const parsed = await genericBundleV1ParserAdapter.parse({
    file: {
      fileName: "phase1-bundle.zip",
      extension: "zip",
      sizeBytes: 512,
      bytes: new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
    },
    extractedBundleEntries: [
      { path: "manifest.json", text: JSON.stringify(manifest) },
      { path: "trades.csv", text: tradesCsv },
      { path: "metadata.json", text: JSON.stringify({ strategy_name: "Phase 1 Bundle", source_platform: "fixture", asset_class: "crypto" }) },
      { path: "assumptions.json", text: JSON.stringify({ commission_model: "maker/taker supplied" }) },
      { path: "params.json", text: JSON.stringify({ parameter_set_name: "base", tunable_parameters: { lookback: 20, threshold: 1.2 } }) },
      { path: "parameter_results.csv", text: "run_id,lookback,threshold,net_profit,max_drawdown,sharpe,trade_count\nrun_1,10,1.2,100,20,1.1,2\nrun_2,20,1.2,80,18,0.9,2" },
      { path: "run_manifest.json", text: JSON.stringify({ base_run_id: "run_2", parameter_names: ["lookback", "threshold"] }) },
      { path: "ohlcv.csv", text: "timestamp,open,high,low,close,volume\n2026-01-01T00:00:00Z,100,101,99,100.5,1000" },
      { path: "benchmark.csv", text: "timestamp,equity\n2026-01-01T00:00:00Z,100000" },
      { path: "broker_export.csv", text: "fill_id,symbol,price,quantity,fee\nf1,BTCUSDT,100,1,0.1" },
      { path: "declared_claims.json", text: JSON.stringify({ claims: [{ claim: "Positive expectancy after fees", priority: "high" }] }) },
    ],
  });

  assert.ok(parsed.parsed);
  assert.equal(parsed.parsed.artifact_kind, "bundle_v1");
  assert.equal(parsed.parsed.strategy_truth_room_contract_version, STRATEGY_TRUTH_ROOM_CONTRACT_VERSION);
  assert.equal(parsed.parsed.bundle_manifest?.bundle_type, "strategy_truth_room_bundle_v1");
  assert.equal(parsed.parsed.ohlcv_present, true);
  assert.equal(parsed.parsed.benchmark_present, true);
  assert.equal(parsed.parsed.broker_export_present, true);
  assert.equal(parsed.parsed.parameter_sweep_present, true);
  assert.equal(parsed.parsed.declared_claims?.[0]?.claim, "Positive expectancy after fees");
  assert.ok(parsed.parsed.source_files?.some((file) => file.role === "broker_export_v1"));
  assert.equal(parsed.parsed.diagnostic_eligibility.regimes.availability, "available");
  assert.equal(parsed.parsed.diagnostic_eligibility.stability.availability, "available");
});
