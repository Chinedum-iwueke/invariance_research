import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { hashLifecycleEvent, validateResearchLifecycleEvent, type ResearchLifecycleEvent } from "../src/lib/contracts/research-lifecycle";
import type { ResearchProposal } from "../src/lib/server/research-copilot/models";
import { buildDraftCardFromProposal, buildSpecBundle, canonicalHash, confirmCard, validateHypothesisCardV1 } from "../src/lib/server/research-specs-v2/generation";

test("C1 lifecycle fixture is valid and hashes identically to bulletproof_bt", () => {
  const event = JSON.parse(readFileSync("tests/fixtures/research_lifecycle_event_v1.json", "utf8")) as ResearchLifecycleEvent;
  assert.deepEqual(validateResearchLifecycleEvent(event), []);
  assert.equal(hashLifecycleEvent(event), "0ac9665c22c5a1a0877b3dee60b6751aaa162589f7ddeeaf104b408dd8f4cc63");
});

test("C1 deployment stages require a deployment identity", () => {
  const event = JSON.parse(readFileSync("tests/fixtures/research_lifecycle_event_v1.json", "utf8")) as ResearchLifecycleEvent;
  event.identity.stage = "live";
  assert.ok(validateResearchLifecycleEvent(event).includes("stage_identity_deployment_id_required"));
});

function proposal(): ResearchProposal {
  return { proposal_id: "proposal-1", conversation_id: "conversation-1", program_id: "program-1", account_id: "account-1", source_message_id: "message-1", proposal_type: "candidate_hypothesis", status: "confirmed", title: "Displacement continuation", payload: { schema_version: "candidate_hypothesis_v1", claim: "Large closed-bar displacement predicts short-horizon continuation.", mechanism: "Urgent order flow takes liquidity across levels.", observable_proxy: "True range divided by lagged ATR.", expected_direction: "Continuation", horizon: "15m", entry_idea: "Enter after displacement", exit_idea: "Fixed stop and bounded hold", required_datasets: ["OHLCV"], falsification_test: "No positive net EV after costs.", failure_modes: ["Volatility proxy only"], implementation_readiness: "likely_supported", rationale: "A narrow first test.", source_citations: [] }, provenance: {}, version: 1, content_hash: "hash", created_at: "2026-06-23T00:00:00Z", confirmed_at: "2026-06-23T00:00:00Z", confirmed_by_user_id: "user-1" };
}

test("C1.5 confirmed proposal produces a reviewable card, then byte-stable portable specs", () => {
  const draft = buildDraftCardFromProposal({ proposal: proposal(), programId: "program-1", userId: "user-1", now: "2026-06-23T00:00:00Z" });
  assert.equal(draft.status, "draft");
  assert.ok(validateHypothesisCardV1(draft).length === 0);
  const confirmed = confirmCard(draft, "user-1", "2026-06-23T00:01:00Z");
  assert.deepEqual(validateHypothesisCardV1(confirmed, true), []);
  const one = buildSpecBundle(confirmed);
  const two = buildSpecBundle(confirmed);
  assert.equal(canonicalHash(one), canonicalHash(two));
  assert.equal(one.compile_readiness.status, "graph_compilable");
  assert.equal(one.run_config.strategy.name, "research_graph_v1");
  assert.match(one.engine_hypothesis_yaml_text, /truth_contract:/);
});

test("C1.5 custom exits produce implementation evidence instead of executable config", () => {
  const draft = buildDraftCardFromProposal({ proposal: proposal(), programId: "program-1", userId: "user-1", now: "2026-06-23T00:00:00Z" });
  draft.exit = { type: "state_machine", trailing_stop: "custom" };
  const confirmed = confirmCard(draft, "user-1", "2026-06-23T00:01:00Z");
  const bundle = buildSpecBundle(confirmed);
  assert.equal(bundle.compile_readiness.status, "implementation_required");
  assert.ok("implementation_task" in bundle);
  assert.ok(!("run_config" in bundle));
});

test("C1.5 migrations and approval UI cover immutable card/spec/task persistence", () => {
  const migrations = readFileSync("src/lib/server/persistence/migrations.ts", "utf8");
  const ui = readFileSync("src/components/research-programs/hypothesis-card-bridge.tsx", "utf8");
  for (const table of ["program_lifecycle_events", "hypothesis_cards", "research_spec_bundles", "strategy_implementation_tasks"]) assert.match(migrations, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  for (const action of ["create_from_proposal", "revise", "confirm", "generate", "approve_bundle"]) assert.match(ui, new RegExp(action));
});

test("C1.5 persists the confirmed-card to approved-bundle lifecycle", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "invariance-c15-"));
  process.env.DATABASE_PROVIDER = "sqlite";
  process.env.INVARIANCE_DB_PATH = path.join(root, "bridge.sqlite");
  process.env.INVARIANCE_STORAGE_ROOT = path.join(root, "storage");
  process.env.LLM_RESEARCH_ASSISTANT_ENABLED = "false";
  process.env.ADMIN_EMAILS = "";
  process.env.INVARIANCE_PLATFORM_PAUSED = "false";
  process.env.INVARIANCE_ASSISTANT_PAUSED = "false";
  const [{ accountService }, programs, copilot, bridge, persistence] = await Promise.all([
    import("../src/lib/server/accounts/service"), import("../src/lib/server/research-programs/service"),
    import("../src/lib/server/research-copilot/service"), import("../src/lib/server/research-specs-v2/service"),
    import("../src/lib/server/persistence/database"),
  ]);
  try {
    const identity = await accountService.ensureUserAndAccount({ email: "c15@example.com", name: "C1.5", emailVerified: true });
    const program = await programs.createResearchProgram({ account_id: identity.account.account_id, owner_user_id: identity.user.user_id, title: "Portable displacement", thesis: "Test displacement continuation.", market: "crypto" });
    const turn = await copilot.sendProgramCopilotMessage({ programId: program.program_id, accountId: identity.account.account_id, userId: identity.user.user_id, content: "Test whether a large closed-bar BTC return predicts continuation with a fixed stop and time exit." });
    await copilot.decideProgramProposal({ programId: program.program_id, accountId: identity.account.account_id, userId: identity.user.user_id, proposalId: turn.proposals[0].proposal_id, decision: "confirmed" });
    const card = await bridge.createCardFromProposal({ programId: program.program_id, proposalId: turn.proposals[0].proposal_id, accountId: identity.account.account_id, userId: identity.user.user_id });
    const revised = await bridge.reviseCard({ programId: program.program_id, cardRecordId: card.card_record_id, accountId: identity.account.account_id, userId: identity.user.user_id, card: { ...card.card, exit: { type: "state_machine", trailing_stop: "custom" } } });
    const confirmed = await bridge.confirmHypothesisCard({ programId: program.program_id, cardRecordId: revised.card_record_id, accountId: identity.account.account_id, userId: identity.user.user_id });
    const bundle = await bridge.generateResearchSpecBundle({ programId: program.program_id, cardRecordId: confirmed.card_record_id, accountId: identity.account.account_id, userId: identity.user.user_id });
    assert.equal(bundle.compile_status, "implementation_required");
    assert.equal((await bridge.generateResearchSpecBundle({ programId: program.program_id, cardRecordId: confirmed.card_record_id, accountId: identity.account.account_id, userId: identity.user.user_id })).spec_bundle_id, bundle.spec_bundle_id);
    await bridge.approveResearchSpecBundle({ programId: program.program_id, bundleId: bundle.spec_bundle_id, accountId: identity.account.account_id, userId: identity.user.user_id });
    let detail = await bridge.getResearchSpecBridgeDetail(program.program_id, identity.account.account_id);
    const task = detail.implementation_tasks[0];
    const required = task.task.required_evidence as string[];
    await bridge.submitImplementationEvidence({ programId: program.program_id, taskId: task.task_id, accountId: identity.account.account_id, userId: identity.user.user_id, evidence: { diff_hash: "a".repeat(64), submitted: Object.fromEntries(required.map((key) => [key, { status: "pass", artifact_hash: "b".repeat(64) }])) } });
    await bridge.approveImplementationTask({ programId: program.program_id, taskId: task.task_id, accountId: identity.account.account_id, userId: identity.user.user_id });
    detail = await bridge.getResearchSpecBridgeDetail(program.program_id, identity.account.account_id);
    assert.equal(detail.cards[0].status, "confirmed");
    assert.equal(detail.bundles[0].status, "approved");
    assert.equal(detail.implementation_tasks[0].status, "approved");
    assert.equal((persistence.getDb().prepare("SELECT COUNT(*) AS count FROM program_lifecycle_events WHERE program_id=?").get(program.program_id) as { count: number }).count, 3);
  } finally {
    persistence.closeDbForTests();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
