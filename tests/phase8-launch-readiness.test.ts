import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "invariance-phase8-launch-"));
process.env.INVARIANCE_DB_PATH = path.join(tempDir, "test.sqlite");
process.env.INVARIANCE_STORAGE_ROOT = path.join(tempDir, "storage");

import { renderExport } from "../src/lib/server/exports/export-renderer";
import { runStartupValidation } from "../src/lib/server/ops/startup-validation";
import { closeDbForTests } from "../src/lib/server/persistence/database";
import type { AnalysisRecord } from "../src/lib/contracts";

const mockRecord: AnalysisRecord = {
  analysis_id: "analysis-pdf-1",
  status: "completed",
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
  strategy: {
    strategy_name: "Launch Readiness Strategy",
    strategy_type: "Trend",
    asset_class: "Equities",
    symbols: ["SPY"],
    direction: "long_only",
    source_type: "upload",
  },
  dataset: {
    market: "US",
    broker_or_exchange: "NYSE",
    start_date: "2025-01-01",
    end_date: "2025-12-31",
    trade_count: 120,
    bar_count: 1200,
    currency: "USD",
  },
  run_context: {
    execution_model: "baseline",
    monte_carlo: "1000",
    risk_model: "fixed",
  },
  summary: {
    robustness_score: { label: "Robustness", value: "80", band: "good" },
    overfitting_risk: { label: "Overfitting", value: "low", band: "moderate" },
    execution_resilience: { label: "Execution", value: "stable", band: "good" },
    regime_dependence: { label: "Regime", value: "moderate", band: "moderate" },
    capital_survivability: { label: "Capital", value: "strong", band: "good" },
    headline_verdict: { status: "strong", title: "Strong", summary: "Launch grade" },
    short_summary: "good",
    key_findings: ["Finding 1", "Finding 2"],
    warnings: [],
  },
  diagnostics: {
    overview: {
      metrics: [],
      interpretation: { title: "", summary: "" },
      verdict: { status: "strong", title: "", summary: "" },
    },
    distribution: { metrics: [], interpretation: { title: "", summary: "" } },
    monte_carlo: { metrics: [], interpretation: { title: "", summary: "" } },
    stability: { metrics: [], interpretation: { title: "", summary: "" }, locked: true },
    execution: { metrics: [], interpretation: { title: "", summary: "" } },
    regimes: { metrics: [], interpretation: { title: "", summary: "" }, locked: true },
    ruin: { metrics: [], interpretation: { title: "", summary: "" }, assumptions: [] },
    report: { sections: [] },
  },
};

test.after(() => {
  closeDbForTests();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("pdf export renderer emits application/pdf payload", () => {
  const rendered = renderExport(mockRecord, "pdf");
  const prefix = Buffer.from(rendered.bytes).subarray(0, 8).toString("utf8");
  assert.equal(rendered.content_type, "application/pdf");
  assert.equal(rendered.file_name, "analysis-pdf-1.pdf");
  assert.equal(prefix.startsWith("%PDF-1."), true);
});

test("startup validation reports worker readiness checks", async () => {
  const checks = await runStartupValidation();
  const names = checks.map((check) => check.name);
  assert.ok(names.includes("analysis_worker"));
  assert.ok(names.includes("export_worker"));
  assert.ok(names.includes("queue"));
});
