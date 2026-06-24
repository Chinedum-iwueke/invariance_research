import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { hashCanonical, validateDecisionState } from "../src/lib/server/research-c4/assessment";
import type { DecisionStateSnapshot, TradeEpisode } from "../src/lib/server/research-c4/models";

test("C4 rejects future-enriched state and exposes advisory-only product language", () => {
  const snapshot: DecisionStateSnapshot = {
    schema_version: "decision_state_snapshot_v1",
    state_snapshot_id: "s",
    account_id: "a",
    program_id: "p",
    stage: "backtest",
    strategy_spec_hash: "strategy",
    symbol: "BTCUSDT",
    decision_at: "2026-01-01T00:00:00.000Z",
    captured_at: "2026-01-01T00:00:00.000Z",
    features: { volatility: 0.1 },
    feature_timestamps: { volatility: "2026-01-01T00:01:00.000Z" },
    missing_features: [],
    provenance: {},
    future_enriched: false,
    snapshot_hash: "h",
    created_at: "2026-01-01T00:00:00.000Z",
  };
  assert.deepEqual(validateDecisionState(snapshot), ["state_snapshot_future_feature:volatility"]);
  const ui = fs.readFileSync("src/components/research-programs/trade-memory-panel.tsx", "utf8");
  assert.match(ui, /Advisory only/);
  assert.match(ui, /never authorizes a trade or increases risk/);
  assert.match(ui, /never masquerade as trade outcomes/);
});

test("C4 persistence keeps tenant evidence isolated and separates same-strategy support", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "invariance-c4-"));
  process.env.DATABASE_PROVIDER = "sqlite";
  process.env.INVARIANCE_DB_PATH = path.join(root, "c4.sqlite");
  const [{ accountService }, programs, { c4Repository }, service, persistence] = await Promise.all([
    import("../src/lib/server/accounts/service"),
    import("../src/lib/server/research-programs/service"),
    import("../src/lib/server/research-c4/repository"),
    import("../src/lib/server/research-c4/service"),
    import("../src/lib/server/persistence/database"),
  ]);
  try {
    const owner = await accountService.ensureUserAndAccount({ email: "c4@example.com", name: "C4", emailVerified: true });
    const foreign = await accountService.ensureUserAndAccount({ email: "foreign-c4@example.com", name: "Foreign", emailVerified: true });
    const program = await programs.createResearchProgram({ account_id: owner.account.account_id, owner_user_id: owner.user.user_id, title: "Trade memory", thesis: "Only causal state is evidence.", market: "crypto" });
    const foreignProgram = await programs.createResearchProgram({ account_id: foreign.account.account_id, owner_user_id: foreign.user.user_id, title: "Foreign memory", thesis: "Must not cross tenants.", market: "crypto" });

    async function evidence(index: number, accountId = owner.account.account_id, programId = program.program_id) {
      const at = new Date(Date.UTC(2026, 0, index + 1)).toISOString();
      const stateBase = { schema_version: "decision_state_snapshot_v1" as const, state_snapshot_id: `state-${accountId}-${index}`, account_id: accountId, program_id: programId, stage: "backtest" as const, strategy_spec_hash: index < 4 ? "strategy-current" : "strategy-other", run_id: `run-${index}`, symbol: "BTCUSDT", decision_at: at, captured_at: at, features: { return_24h: index, volatility_24h: 1 + index / 10 }, feature_timestamps: { return_24h: at, volatility_24h: at }, missing_features: [], provenance: { source: "test" }, future_enriched: false as const };
      const state: DecisionStateSnapshot = { ...stateBase, snapshot_hash: hashCanonical(stateBase), created_at: at };
      await c4Repository.saveSnapshot(state);
      const episode: TradeEpisode = { schema_version: "trade_episode_v1", episode_id: `episode-${accountId}-${index}`, account_id: accountId, program_id: programId, stage: "backtest", run_id: `run-${index}`, strategy_spec_hash: state.strategy_spec_hash, product_type: "perpetual", symbol: "BTCUSDT", side: "buy", opened_at: at, closed_at: new Date(Date.UTC(2026, 0, index + 1, 1)).toISOString(), quantity: 1, entry_price: 100, exit_price: index % 3 === 0 ? 99 : 102, gross_pnl: index % 3 === 0 ? -1 : 2, fees: 0.1, net_pnl: index % 3 === 0 ? -1.1 : 1.9, status: "closed", decision_state_snapshot_id: state.state_snapshot_id, source_event_ids: [], source_fill_ids: [], data_quality: { causal: true }, created_at: at, updated_at: at };
      await c4Repository.upsertEpisode(episode);
    }
    for (let index = 0; index < 8; index += 1) await evidence(index);
    await evidence(3, foreign.account.account_id, foreignProgram.program_id);

    const assessment = await service.createMemoryAssessment({ programId: program.program_id, accountId: owner.account.account_id, userId: owner.user.user_id, strategySpecHash: "strategy-current", symbol: "BTCUSDT", stage: "backtest", features: { return_24h: 3.5, volatility_24h: 1.35 }, decisionAt: "2026-01-10T00:00:00.000Z" });
    assert.equal(assessment.support_count, 8);
    assert.equal(assessment.strategy_support_count, 4);
    assert.equal(assessment.cross_strategy_support_count, 4);
    assert.equal(assessment.advisory_only, true);
    assert.ok(assessment.uncertainty_interval.length === 2);

    const detail = await service.getC4Detail(program.program_id, owner.account.account_id);
    assert.equal(detail.episodes.length, 8);
    await assert.rejects(() => service.getC4Detail(program.program_id, foreign.account.account_id), /program_not_found/);
    const governed = await service.syncGovernedResearchMemory(program.program_id, owner.account.account_id);
    assert.equal(governed.excluded_raw_messages, true);
    assert.equal(governed.excluded_unconfirmed_proposals, true);
  } finally {
    persistence.closeDbForTests();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("C4 ships schemas, API actions, worker ingestion, and write-only connector replacement", () => {
  for (const schema of ["trade_episode_v1", "decision_state_snapshot_v1", "memory_assessment_v1"]) assert.ok(fs.existsSync(path.join("../bulletproof_bt/schemas", `${schema}.schema.json`)));
  const api = fs.readFileSync("src/app/api/programs/[id]/memory-assessments/route.ts", "utf8");
  for (const action of ["sync_backtest", "sync_governed", "assess"]) assert.match(api, new RegExp(action));
  const worker = fs.readFileSync("src/lib/server/workers/execution-worker.ts", "utf8");
  assert.match(worker, /ingestDeploymentFills/);
  const connector = fs.readFileSync("src/components/research-programs/deployment-command-center.tsx", "utf8");
  assert.match(connector, /type="password"/);
  assert.match(connector, /replace_credentials/);
  assert.match(connector, /spot/);
  assert.match(connector, /perpetual/);
});
