import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildEvidenceLedger,
  buildUploadEvidenceProjection,
  overlayEvidenceEntitlements,
  reconcileDiagnosticStatus,
} from "../src/lib/server/evidence/evidence-ledger-service.ts";
import type { EngineCapabilityProfile } from "../src/lib/server/engine/engine-types.ts";
import type { UploadEligibilitySummary } from "../src/lib/server/ingestion/contracts.ts";

const expectedEnvelope = JSON.parse(readFileSync("tests/fixtures/engine-seam/trade_csv_limited_expected_envelope.json", "utf-8")) as {
  engine_name: string;
  seam_name: string;
  seam_version: string;
};

const tradeOnlyEligibility: UploadEligibilitySummary = {
  accepted: true,
  detected_artifact_type: "trade_csv",
  detected_richness: "trade_only",
  diagnostics_available: ["overview", "distribution", "monte_carlo", "execution", "ruin", "report"],
  diagnostics_limited: [],
  diagnostics_unavailable: ["regimes", "stability"],
  limitation_reasons: ["regimes requires richer market context", "stability requires parameter metadata"],
  parser_notes: [],
  summary_text: "Trade CSV accepted with limited context.",
};

test("upload evidence projection preserves artifact eligibility before engine execution", () => {
  assert.equal(expectedEnvelope.engine_name, "bt");
  assert.equal(expectedEnvelope.seam_name, "run_analysis_from_parsed_artifact");
  assert.equal(expectedEnvelope.seam_version, "1.0.0");

  const ledger = buildUploadEvidenceProjection(tradeOnlyEligibility);

  assert.equal(ledger.by_diagnostic.overview.final_status, "available");
  assert.equal(ledger.by_diagnostic.ruin.final_status, "available");
  assert.equal(ledger.by_diagnostic.regimes.final_status, "unavailable");
  assert.equal(ledger.by_diagnostic.stability.final_status, "unavailable");
});

test("evidence ledger merges artifact and engine capability conservatively", () => {
  const capabilityProfile: EngineCapabilityProfile = {
    overview: { status: "supported", reason: "core trade summary emitted" },
    ruin: { status: "limited", reason: "account sizing assumptions missing" },
    regimes: { status: "supported", reason: "engine can compute regimes" },
    stability: { status: "skipped", reason: "disabled by upstream policy" },
    alpha_decay: { status: "supported" },
  } as EngineCapabilityProfile;

  const ledger = buildEvidenceLedger({ eligibility: tradeOnlyEligibility, capabilityProfile });

  assert.equal(ledger.by_diagnostic.overview.final_status, "available");
  assert.equal(ledger.by_diagnostic.ruin.final_status, "limited");
  assert.equal(ledger.by_diagnostic.regimes.final_status, "unavailable");
  assert.equal(ledger.by_diagnostic.stability.final_status, "unavailable");
  assert.deepEqual(ledger.warnings, ["Unknown engine diagnostic ignored: alpha_decay"]);
});

test("adapter status map is derived from the shared evidence ledger", () => {
  const statuses = reconcileDiagnosticStatus(tradeOnlyEligibility, {
    overview: { status: "supported" },
    execution: { status: "skipped", reason: "disabled by upstream policy" },
  });

  assert.equal(statuses.get("overview"), "available");
  assert.equal(statuses.get("execution"), "skipped");
  assert.equal(statuses.get("regimes"), "unavailable");
});

test("entitlement overlay changes display status without mutating evidence truth", () => {
  const ledger = buildUploadEvidenceProjection(tradeOnlyEligibility);
  const overlaid = overlayEvidenceEntitlements(ledger, { ruin: false });

  assert.equal(overlaid.by_diagnostic.ruin.final_status, "available");
  assert.equal(overlaid.by_diagnostic.ruin.display_status, "locked");
  assert.equal(overlaid.by_diagnostic.ruin.entitlement_status, "locked");
});
