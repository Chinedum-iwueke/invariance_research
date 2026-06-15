import assert from "node:assert/strict";
import test from "node:test";
import { resolveEntitlementsForPlan } from "../src/lib/server/entitlements/entitlements";
import { PLAN_MATRIX } from "../src/lib/server/entitlements/plans";

test("B11 plans price research throughput, not only upload analyses", () => {
  assert.equal(PLAN_MATRIX.free.programs_limit, 1);
  assert.equal(PLAN_MATRIX.explorer.programs_limit, 3);
  assert.equal(PLAN_MATRIX.pro.programs_limit, 10);
  assert.equal(PLAN_MATRIX.research_desk.programs_limit, 50);

  assert.equal(PLAN_MATRIX.free.monthly_experiment_compute_units, 10);
  assert.equal(PLAN_MATRIX.explorer.monthly_experiment_compute_units, 80);
  assert.equal(PLAN_MATRIX.pro.monthly_experiment_compute_units, 250);
  assert.equal(PLAN_MATRIX.research_desk.monthly_experiment_compute_units, 1000);

  assert.equal(PLAN_MATRIX.free.monthly_assistant_calls, 10);
  assert.equal(PLAN_MATRIX.explorer.monthly_assistant_calls, 100);
  assert.equal(PLAN_MATRIX.pro.monthly_assistant_calls, 500);
});

test("B11 entitlement snapshots expose queue, memory, and assistant limits", () => {
  const snapshot = resolveEntitlementsForPlan("account-1", "pro", "plan_matrix");
  assert.equal(snapshot.programs_limit, 10);
  assert.equal(snapshot.active_hypotheses_limit, 40);
  assert.equal(snapshot.queued_experiments_limit, 40);
  assert.equal(snapshot.concurrent_experiments_limit, 2);
  assert.equal(snapshot.memory_retention_days, 730);
  assert.equal(snapshot.monthly_assistant_calls, 500);
  assert.equal(snapshot.source_of_truth, "plan_matrix");
});
