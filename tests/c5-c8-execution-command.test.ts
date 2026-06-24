import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { normalizeSafetyPolicy } from "../src/lib/server/research-execution/service";

test("C5 strict canary policy rejects incomplete and internally inconsistent limits", () => {
  const symbols = ["BTCUSDT"];
  assert.throws(() => normalizeSafetyPolicy({ allowed_symbols: symbols }, symbols), /safety_policy_invalid/);
  assert.throws(() => normalizeSafetyPolicy({
    allowed_symbols: symbols,
    max_order_quantity: 1,
    max_order_notional_usd: 200,
    max_gross_notional_usd: 100,
    max_open_orders: 1,
    max_open_positions: 1,
    max_daily_loss_usd: 10,
    max_session_loss_usd: 20,
  }, symbols), /order_notional_exceeds_gross_cap/);
  const policy = normalizeSafetyPolicy({
    allowed_symbols: symbols,
    max_order_quantity: 0.01,
    max_order_notional_usd: 50,
    max_gross_notional_usd: 100,
    max_open_orders: 2,
    max_open_positions: 1,
    max_daily_loss_usd: 10,
    max_session_loss_usd: 20,
  }, symbols);
  assert.equal(policy.allow_reduce_only_when_frozen, true);
});

test("C5-C8 migrations build every durable safety and command table", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "invariance-c5-c8-"));
  process.env.DATABASE_PROVIDER = "sqlite";
  process.env.INVARIANCE_DB_PATH = path.join(root, "execution.sqlite");
  const persistence = await import("../src/lib/server/persistence/database");
  try {
    const db = persistence.getDb();
    for (const table of [
      "deployment_promotions",
      "deployment_safety_policies",
      "deployment_incidents",
      "external_alert_deliveries",
      "deployment_recovery_drills",
      "portfolio_snapshots",
      "deployment_audit_actions",
      "memory_policy_configs",
      "memory_policy_evaluations",
      "connector_stream_sessions",
      "connector_certifications",
    ]) {
      const columns = db.prepare(`PRAGMA table_info(${table})`).all();
      assert.ok(columns.length > 0, `${table} was not created`);
    }
  } finally {
    persistence.closeDbForTests();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("C5-C8 authority, alerting, streaming, audit, and parity paths are wired", () => {
  const worker = fs.readFileSync("src/lib/server/workers/execution-worker.ts", "utf8");
  const service = fs.readFileSync("src/lib/server/research-execution/service.ts", "utf8");
  const repository = fs.readFileSync("src/lib/server/research-execution/repository.ts", "utf8");
  const stream = fs.readFileSync("src/app/api/programs/[id]/execution/stream/route.ts", "utf8");
  const surface = fs.readFileSync("src/components/research-programs/execution-command-surface.tsx", "utf8");
  const compose = fs.readFileSync("deploy/docker-compose.worker.yml", "utf8");
  for (const required of [
    "authorizeOrderIntent",
    "probe_private_stream:true",
    "submit_order",
    "emergency_freeze",
    "createHmac",
    "connector_certification",
  ]) assert.match(worker, new RegExp(required));
  for (const required of [
    "demo_qualification_required",
    "private_stream_not_ready",
    "connector_not_certified",
    "memory_calibration_unavailable",
    "resolveMemoryPolicyEvaluation",
  ]) assert.match(service, new RegExp(required));
  assert.match(repository, /false_block/);
  assert.match(repository, /missed_risk/);
  assert.match(stream, /text\/event-stream/);
  assert.match(stream, /Last-Event-ID/i);
  assert.match(surface, /Emergency control/);
  assert.match(surface, /immutable decision-state snapshots/);
  assert.match(surface, /false blocks/);
  assert.match(surface, /missed risks/);
  assert.match(compose, /execution-worker:/);
});

test("C8 engine supports private streams and one certification contract for both venues", () => {
  const root = path.resolve("../bulletproof_bt");
  for (const file of [
    "src/bt/exec/adapters/binance/client_ws_private.py",
    "src/bt/exec/adapters/bybit/client_ws_private.py",
    "src/bt/exec/services/connector_certification.py",
    "src/bt/exec/services/live_canary.py",
    "tests/exec/test_c8_connector_certification.py",
  ]) assert.ok(fs.existsSync(path.join(root, file)), `${file} is missing`);
  const contract = fs.readFileSync(path.join(root, "src/bt/exec/services/connector_certification.py"), "utf8");
  for (const check of ["private_stream_auth", "private_fill_event", "restart_reconciliation", "emergency_freeze", "duplicate_fill_is_idempotent"]) assert.match(contract, new RegExp(check));
});
