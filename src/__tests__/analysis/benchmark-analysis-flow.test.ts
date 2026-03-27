import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "invariance-benchmark-flow-"));
process.env.INVARIANCE_DB_PATH = path.join(tempDir, "test.sqlite");

import { parseBenchmarkSelectionFromRequest, buildPersistedBenchmarkConfig } from "@/lib/analyses/create-analysis";
import { buildAnalysisEngineDispatchPayload } from "@/lib/analyses/analysis-engine-dispatch";
import { buildBenchmarkEnginePayload } from "@/lib/benchmarks/benchmark-engine-contract";
import { accountService } from "@/lib/server/accounts/service";
import { getDb, closeDbForTests } from "@/lib/server/persistence/database";
import { analysisRepository } from "@/lib/server/repositories/analysis-repository";
import { artifactRepository } from "@/lib/server/repositories/artifact-repository";
import { createAnalysisFromArtifact } from "@/lib/server/services/analysis-service";
import type { ParsedArtifact, UploadEligibilitySummary } from "@/lib/server/ingestion";

function resetDb() {
  const db = getDb();
  db.exec(`
    DELETE FROM analysis_jobs;
    DELETE FROM analyses;
    DELETE FROM artifacts;
    DELETE FROM usage_snapshots;
    DELETE FROM entitlement_snapshots;
    DELETE FROM subscriptions;
    DELETE FROM accounts;
    DELETE FROM users;
  `);
}

function writeBenchmarkManifest(root: string) {
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(
    path.join(root, "manifest.v1.yaml"),
    [
      "revision: 'test-revision'",
      "benchmarks:",
      "  - id: BTC",
      "    file: btc.parquet",
      "    frequency: 1d",
      "    source: platform_managed",
      "  - id: SPY",
      "    file: spy.parquet",
      "    frequency: 1d",
      "    source: platform_managed",
      "  - id: XAUUSD",
      "    file: xauusd.parquet",
      "    frequency: 1d",
      "    source: platform_managed",
      "  - id: DXY",
      "    file: dxy.parquet",
      "    frequency: 1d",
      "    source: platform_managed",
      "",
    ].join("\n"),
    "utf8",
  );
}

function seedArtifact(accountId: string, userId: string, artifactId: string, eligibility?: Partial<UploadEligibilitySummary>) {
  const parsedArtifact = {
    artifact_id: artifactId,
    artifact_type: "generic_trade_csv",
    artifact_kind: "trade_csv",
    richness: "trade_only",
    parser_notes: [],
    strategy_metadata: {
      strategy_name: "Benchmark Flow",
      description: "crypto momentum strategy",
      source_platform: "crypto",
    },
    trades: [
      {
        trade_id: "t1",
        symbol: "BTCUSD",
        market: "crypto",
        side: "buy",
        quantity: 1,
        price: 100,
        timestamp: "2025-01-01T00:00:00.000Z",
      },
    ],
    validation: { valid: true, errors: [] },
  } as unknown as ParsedArtifact;

  artifactRepository.save({
    artifact_id: artifactId,
    owner_user_id: userId,
    account_id: accountId,
    file_name: "trades.csv",
    file_type: "text/csv",
    file_size_bytes: 128,
    storage_key: `uploads/${artifactId}.csv`,
    checksum_sha256: "checksum",
    artifact_kind: "trade_csv",
    richness: "trade_only",
    uploaded_at: new Date().toISOString(),
    parsed_artifact: parsedArtifact,
    eligibility_summary: {
      accepted: true,
      parser_notes: [],
      validation_errors: [],
      diagnostics_available: ["overview"],
      diagnostics_limited: [],
      diagnostics_unavailable: [],
      limitation_reasons: [],
      summary_text: "ok",
      detected_artifact_type: "generic_trade_csv",
      detected_richness: "trade_only",
      ...eligibility,
    } as UploadEligibilitySummary,
  });
}

test.beforeEach(() => {
  resetDb();
  const healthyRoot = path.join(tempDir, "benchmark-library-healthy");
  writeBenchmarkManifest(healthyRoot);
  process.env.INVARIANCE_BENCHMARK_LIBRARY_ROOT = healthyRoot;
});

test.after(() => {
  closeDbForTests();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("parseBenchmarkSelectionFromRequest defaults safely and preserves explicit benchmark shape", () => {
  const parsedDefault = parseBenchmarkSelectionFromRequest({ artifact_id: "a-1" });
  assert.deepEqual(parsedDefault, { mode: "auto", requested_id: null });

  const parsedManual = parseBenchmarkSelectionFromRequest({
    artifact_id: "a-1",
    benchmark: { mode: "manual", requested_id: "SPY" },
  });
  assert.deepEqual(parsedManual, { mode: "manual", requested_id: "SPY" });
});

test("buildPersistedBenchmarkConfig resolves detected benchmark and sets persisted contract fields", async () => {
  const parsedArtifact = {
    strategy_metadata: { description: "equity mean reversion" },
    trades: [{ market: "equities", symbol: "SPY" }],
  } as unknown as ParsedArtifact;

  const benchmark = await buildPersistedBenchmarkConfig({
    selection: { mode: "auto", requested_id: null },
    parsedArtifact,
  });

  assert.equal(benchmark.enabled, true);
  assert.equal(benchmark.mode, "auto");
  assert.equal(benchmark.resolved_id, "SPY");
  assert.equal(benchmark.source, "platform_managed");
  assert.equal(benchmark.frequency, "1d");
  assert.equal(typeof benchmark.library_revision, "string");
});

test("analysis creation persists benchmark config and dispatch sends explicit enabled contract", async () => {
  const { user, account } = accountService.ensureUserAndAccount({ email: "benchmark-flow@example.com" });
  seedArtifact(account.account_id, user.user_id, "artifact-flow-1");

  const created = await createAnalysisFromArtifact({
    artifact_id: "artifact-flow-1",
    owner_user_id: user.user_id,
    account_id: account.account_id,
    benchmark: { mode: "manual", requested_id: "DXY" },
  });

  const analysis = analysisRepository.findById(created.analysis_id);
  assert.ok(analysis?.benchmark);
  assert.equal(analysis?.benchmark?.enabled, true);
  assert.equal(analysis?.benchmark?.resolved_id, "DXY");

  const dispatch = await buildAnalysisEngineDispatchPayload({
    analysis: analysis!,
    parsedArtifact: artifactRepository.findById("artifact-flow-1")!.parsed_artifact,
    eligibility: artifactRepository.findById("artifact-flow-1")!.eligibility_summary,
  });

  assert.equal(dispatch.config.benchmark.enabled, true);
  if (dispatch.config.benchmark.enabled) {
    assert.equal(dispatch.config.benchmark.id, "DXY");
    assert.equal(dispatch.config.benchmark.source, "platform_managed");
    assert.equal(dispatch.config.benchmark.mode, "manual");
    assert.equal(dispatch.config.benchmark.comparison_frequency, "1d");
    assert.equal(dispatch.config.benchmark.normalization_basis, "100_at_first_common_timestamp");
  }
  assert.deepEqual(dispatch.warnings, []);
});

test("disabled benchmark remains explicit through engine payload contract", () => {
  const payload = buildBenchmarkEnginePayload({
    analysis_id: "a-disabled",
    owner_user_id: "u",
    account_id: "acct",
    status: "queued",
    artifact_id: "artifact",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    benchmark: {
      mode: "none",
      requested_id: null,
      resolved_id: null,
      resolution_reason: "user_selected_none",
      source: null,
      frequency: null,
      library_revision: null,
      enabled: false,
    },
  });

  assert.deepEqual(payload, { enabled: false, mode: "none" });
});

test("dispatch fails safe by disabling benchmark when library is unhealthy", async () => {
  process.env.INVARIANCE_BENCHMARK_LIBRARY_ROOT = path.join(tempDir, "missing-library-root");

  const dispatch = await buildAnalysisEngineDispatchPayload({
    analysis: {
      analysis_id: "a-unhealthy",
      owner_user_id: "u",
      account_id: "acct",
      status: "queued",
      artifact_id: "artifact",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      benchmark: {
        mode: "auto",
        requested_id: null,
        resolved_id: "BTC",
        resolution_reason: "detected_asset_class_crypto",
        source: "platform_managed",
        frequency: "1d",
        library_revision: "r1",
        enabled: true,
      },
    },
    parsedArtifact: { trades: [] } as unknown as ParsedArtifact,
    eligibility: {
      accepted: true,
      parser_notes: [],
      validation_errors: [],
      diagnostics_available: ["overview"],
      diagnostics_limited: [],
      diagnostics_unavailable: [],
      limitation_reasons: [],
      summary_text: "ok",
      detected_artifact_type: "generic_trade_csv",
      detected_richness: "trade_only",
    },
  });

  assert.deepEqual(dispatch.config.benchmark, { enabled: false, mode: "none" });
  assert.match(dispatch.warnings.join(","), /benchmark_library_unhealthy_benchmark_disabled/);
});
