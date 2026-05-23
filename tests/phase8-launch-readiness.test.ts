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
      figures: [],
      interpretation: { title: "", summary: "" },
      verdict: { status: "strong", title: "", summary: "" },
    },
    distribution: { metrics: [], figures: [], interpretation: { title: "", summary: "" } },
    monte_carlo: { metrics: [], figures: [], interpretation: { title: "", summary: "" } },
    stability: { metrics: [], figure: undefined, interpretation: { title: "", summary: "" }, locked: true },
    execution: { metrics: [], figures: [], interpretation: { title: "", summary: "" } },
    regimes: { metrics: [], figures: [], interpretation: { title: "", summary: "" }, locked: true },
    ruin: { metrics: [], figure: undefined, interpretation: { title: "", summary: "" }, assumptions: [] },
    report: { sections: [] },
  },
  engine_payload: {
    summary_metrics: [],
    diagnostics: { overview: { status: "available", summary_metrics: [], figures: [], assumptions: [], warnings: [], recommendations: [], limitations: [] } },
    report_sections: { assumptions: [], limitations: [], recommendations: ["Monitor live slippage."] },
    raw_result: {},
  },
  report: {
    report_id: "report-analysis-pdf-1",
    executive_summary: "Launch-grade validation report.",
    diagnostics_summary: ["Overview available."],
    methodology_assumptions: ["Trade-level fixture."],
    limitations: [],
    recommendations: ["Monitor live slippage."],
    deployment_guidance: ["Proceed in phases."],
    figures: [],
    source: "summary_fallback",
    export_ready: true,
    generated_at: "2026-01-01",
  },
  diagnostic_statuses: {
    overview: { status: "available", available: true, limited: false, unavailable: false, skipped: false },
    distribution: { status: "available", available: true, limited: false, unavailable: false, skipped: false },
    monte_carlo: { status: "available", available: true, limited: false, unavailable: false, skipped: false },
    stability: { status: "skipped", available: false, limited: false, unavailable: false, skipped: true },
    execution: { status: "available", available: true, limited: false, unavailable: false, skipped: false },
    regimes: { status: "skipped", available: false, limited: false, unavailable: false, skipped: true },
    ruin: { status: "available", available: true, limited: false, unavailable: false, skipped: false },
    report: { status: "available", available: true, limited: false, unavailable: false, skipped: false },
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
  assert.equal(rendered.file_name, "analysis-pdf-1-validation-report-live.pdf");
  assert.equal(prefix.startsWith("%PDF-1."), true);
  const pdfText = Buffer.from(rendered.bytes).toString("utf8");
  assert.match(pdfText, /INVARIANCE RESEARCH/);
  assert.match(pdfText, /STRATEGY TRUTH ROOM/);
  assert.match(pdfText, /Institutional Validation Memo/);
  assert.match(pdfText, /Page 1 of/);
});

test("startup validation reports worker readiness checks", async () => {
  const checks = await runStartupValidation();
  const names = checks.map((check) => check.name);
  assert.ok(names.includes("analysis_worker"));
  assert.ok(names.includes("export_worker"));
  assert.ok(names.includes("queue"));
});

test("worker deploy stack includes analysis and export workers", () => {
  const deployRoot = path.join(process.cwd(), "deploy");
  const compose = fs.readFileSync(path.join(deployRoot, "docker-compose.worker.yml"), "utf8");
  const env = fs.readFileSync(path.join(deployRoot, ".env.worker"), "utf8");
  const readme = fs.readFileSync(path.join(deployRoot, "README.worker.md"), "utf8");

  assert.match(compose, /analysis-worker:/);
  assert.match(compose, /export-worker:/);
  assert.match(compose, /command:\s*\["npm", "run", "worker:export"\]/);
  assert.match(compose, /INVARIANCE_WORKER_KIND:\s*export-worker/);
  assert.match(env, /INVARIANCE_EXPORT_WORKER_POLL_MS=1000/);
  assert.match(readme, /docker logs -f invariance-export-worker/);
  assert.equal(readme.includes("export workers are intentionally not included yet"), false);
});
