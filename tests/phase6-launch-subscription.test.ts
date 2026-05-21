import assert from "node:assert/strict";
import test from "node:test";

import { BILLING_PLAN_CATALOG, STRIPE_WEBHOOK_PLAN_BY_PRICE } from "../src/lib/server/billing/billing-config.ts";
import { buildDiagnosticLockModel } from "../src/lib/app/diagnostic-locks.ts";
import { PLAN_MATRIX, canonicalPlanId } from "../src/lib/server/entitlements/plans.ts";

test("phase 6 launch plan matrix matches sellable packaging", () => {
  assert.equal(PLAN_MATRIX.free.analyses_per_month, 3);
  assert.equal(PLAN_MATRIX.free.can_export_report, false);
  assert.equal(PLAN_MATRIX.free.can_create_share_links, false);

  assert.equal(PLAN_MATRIX.individual.can_export_report, true);
  assert.equal(PLAN_MATRIX.individual.can_view_execution, true);
  assert.equal(PLAN_MATRIX.individual.prop_evaluation_profiles, 1);
  assert.equal(PLAN_MATRIX.individual.share_links_per_month, 5);

  assert.equal(PLAN_MATRIX.pro.can_view_regimes, true);
  assert.equal(PLAN_MATRIX.pro.can_view_stability, true);
  assert.equal(PLAN_MATRIX.pro.can_request_research_desk, true);

  assert.equal(PLAN_MATRIX.team.max_seats, 5);
  assert.equal(PLAN_MATRIX.team.prop_evaluation_profiles, "shared");
  assert.equal(PLAN_MATRIX.research_desk.processing_priority, "institutional");
});

test("legacy plan ids map safely into launch plan semantics", () => {
  assert.equal(canonicalPlanId("explorer"), "free");
  assert.equal(canonicalPlanId("professional"), "individual");
  assert.equal(canonicalPlanId("research_lab"), "pro");
  assert.equal(canonicalPlanId("advisory"), "research_desk");
  assert.equal(PLAN_MATRIX.professional.can_export_report, PLAN_MATRIX.individual.can_export_report);
});

test("stripe test-mode catalog has every paid self-serve launch tier", () => {
  const byId = new Map(BILLING_PLAN_CATALOG.map((entry) => [entry.id, entry]));
  for (const plan of ["individual", "pro", "team"] as const) {
    const entry = byId.get(plan);
    assert.equal(entry?.self_serve_checkout, true);
    assert.ok(entry?.stripe_price_id?.startsWith("price_") || entry?.stripe_price_id?.startsWith("prod_") || entry?.stripe_price_id);
  }
  assert.equal(byId.get("research_desk")?.self_serve_checkout, false);
  assert.equal(STRIPE_WEBHOOK_PLAN_BY_PRICE[process.env.STRIPE_PRICE_TEAM ?? "price_team"], "team");
});

test("plan lock copy separates subscription locks from evidence locks", () => {
  const planLocked = buildDiagnosticLockModel({
    state: "plan_locked",
    diagnosticTitle: "Parameter Stability",
    diagnosticPurpose: "Assess parameter fragility.",
    currentPlan: "Free",
    requiredPlan: "Pro",
  });
  assert.equal(planLocked.badgeLabel, "Plan Locked");
  assert.match(planLocked.primaryExplanation, /Pro plan and above/i);
  assert.equal(planLocked.actions[0]?.label, "Upgrade to Pro");

  const artifactLocked = buildDiagnosticLockModel({
    state: "artifact_unavailable",
    diagnosticTitle: "Regime Analysis",
    diagnosticPurpose: "Decompose performance by market regime.",
    artifactRequirementProfile: "regime_analysis",
  });
  assert.equal(artifactLocked.badgeLabel, "Artifact Limited");
  assert.equal(artifactLocked.actions.some((action) => action.label.startsWith("Upgrade")), false);
});
