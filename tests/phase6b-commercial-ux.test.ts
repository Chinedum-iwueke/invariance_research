import assert from "node:assert/strict";
import test from "node:test";
import { buildDiagnosticLockModel } from "../src/lib/app/diagnostic-locks.ts";
import {
  isQuotaExceeded,
  isReportExportPlanRestricted,
  isUploadPlanRestricted,
  shouldShowDiagnosticUpgrade,
} from "../src/lib/app/upgrade-visibility.ts";

test("artifact-limited model does not prioritize upgrade CTA", () => {
  const model = buildDiagnosticLockModel({
    state: "artifact_unavailable",
    diagnosticTitle: "Regime Analysis",
    diagnosticPurpose: "Decompose performance by market regime.",
  });

  assert.equal(model.badgeLabel, "Artifact Limited");
  assert.match(model.primaryExplanation, /trade-level results only/i);
  assert.equal(model.actions[0]?.label, "Upload richer artifact");
  assert.equal(model.actions.some((action) => action.label.startsWith("Upgrade")), false);
  assert.equal(shouldShowDiagnosticUpgrade("artifact_unavailable"), false);
});

test("engine-limited model does not prioritize upgrade CTA", () => {
  const model = buildDiagnosticLockModel({
    state: "engine_unavailable",
    diagnosticTitle: "Stability",
    diagnosticPurpose: "Assess parameter fragility.",
  });

  assert.equal(model.badgeLabel, "Engine Limited");
  assert.match(model.primaryExplanation, /cannot yet compute this diagnostic credibly/i);
  assert.equal(model.actions[0]?.label, "View supported diagnostics");
  assert.equal(model.actions.some((action) => action.label.startsWith("Upgrade")), false);
  assert.equal(shouldShowDiagnosticUpgrade("engine_unavailable"), false);
});

test("plan-locked model has upgrade as primary action", () => {
  const model = buildDiagnosticLockModel({
    state: "plan_locked",
    diagnosticTitle: "Execution Sensitivity",
    diagnosticPurpose: "Stress edge against friction.",
    currentPlan: "Explorer",
    requiredPlan: "Professional",
  });

  assert.equal(model.badgeLabel, "Plan Locked");
  assert.match(model.primaryExplanation, /Professional plan and above/i);
  assert.equal(model.actions[0]?.label, "Upgrade to Professional");
  assert.equal(model.actions[0]?.emphasis, "primary");
  assert.equal(shouldShowDiagnosticUpgrade("plan_locked"), true);
});

test("lock model exposes all structural panel sections", () => {
  const model = buildDiagnosticLockModel({
    state: "plan_locked",
    diagnosticTitle: "Report Export",
    diagnosticPurpose: "Generate shareable report artifacts.",
    currentPlan: "Explorer",
    requiredPlan: "Professional",
  });

  assert.ok(model.diagnosticTitle.length > 0);
  assert.ok(model.diagnosticPurpose.length > 0);
  assert.ok(model.primaryExplanation.length > 0);
  assert.ok(model.unlockRequirements.length >= 3);
  assert.ok(model.actions.length >= 2);
  assert.ok(model.footerNote.length > 0);
});

test("quota, export, and upload gating triggers remain explicit", () => {
  assert.equal(isQuotaExceeded("monthly_analysis_limit_reached"), true);
  assert.equal(isQuotaExceeded("artifact_access_denied"), false);
  assert.equal(isReportExportPlanRestricted(false), true);
  assert.equal(isReportExportPlanRestricted(true), false);
  assert.equal(isUploadPlanRestricted("plan_upload_locked"), true);
  assert.equal(isUploadPlanRestricted("unsupported_artifact_structure"), false);
});
