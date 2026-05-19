import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "invariance-postlaunch-"));
process.env.INVARIANCE_DB_PATH = path.join(tempDir, "test.sqlite");
process.env.INVARIANCE_STORAGE_ROOT = path.join(tempDir, "storage");
process.env.BENCHMARK_MANIFEST_CACHE_TTL_MS = "60000";

import { accountService } from "../src/lib/server/accounts/service";
import { artifactRepository } from "../src/lib/server/repositories/artifact-repository";
import { analysisRepository } from "../src/lib/server/repositories/analysis-repository";
import { jobRepository } from "../src/lib/server/repositories/job-repository";
import { getDb, closeDbForTests } from "../src/lib/server/persistence/database";
import { clearBenchmarkManifestCacheForTests, loadBenchmarkManifest } from "../src/server/benchmark-library/load-manifest";
import { getBenchmarkManifestCacheStatus } from "../src/lib/benchmarks/benchmark-library";
import { checkRateLimit, rateLimitKey } from "../src/lib/server/rate-limits";

function resetDb() {
  getDb().exec(`
    DELETE FROM rate_limit_buckets;
    DELETE FROM analysis_jobs;
    DELETE FROM evidence_events;
    DELETE FROM analyses;
    DELETE FROM artifacts;
    DELETE FROM usage_snapshots;
    DELETE FROM entitlement_snapshots;
    DELETE FROM subscriptions;
    DELETE FROM admin_audit_log;
    DELETE FROM user_roles;
    DELETE FROM auth_tokens;
    DELETE FROM accounts;
    DELETE FROM users;
  `);
}

function manifestYaml(revision: string) {
  return `revision: ${revision}
benchmarks:
  - id: BTC
    file: btc.csv
    frequency: 1d
    source: platform_managed
  - id: SPY
    file: spy.csv
    frequency: 1d
    source: platform_managed
  - id: XAUUSD
    file: xauusd.csv
    frequency: 1d
    source: platform_managed
  - id: DXY
    file: dxy.csv
    frequency: 1d
    source: platform_managed
`;
}

async function seedJob(suffix: string) {
  const { user, account } = await accountService.ensureUserAndAccount({ email: `worker-${suffix}@example.com` });
  const now = new Date().toISOString();
  const artifactId = `artifact-${suffix}`;
  const analysisId = `analysis-${suffix}`;
  artifactRepository.save({
    artifact_id: artifactId,
    owner_user_id: user.user_id,
    account_id: account.account_id,
    file_name: "trades.csv",
    file_type: "text/csv",
    file_size_bytes: 10,
    storage_key: `uploads/${artifactId}.csv`,
    checksum_sha256: `checksum-${suffix}`,
    artifact_kind: "trade_csv",
    richness: "trade_only",
    uploaded_at: now,
    parsed_artifact: { artifact_id: artifactId, artifact_type: "generic_trade_csv", artifact_kind: "trade_csv", richness: "trade_only", parser_notes: [], strategy_metadata: {}, trades: [], validation: { valid: true, errors: [] } } as any,
    eligibility_summary: { accepted: true, parser_notes: [], validation_errors: [], diagnostics_available: ["overview"], diagnostics_limited: [], diagnostics_unavailable: [], limitation_reasons: [], summary_text: "ok", detected_artifact_type: "generic_trade_csv", detected_richness: "trade_only" } as any,
  });
  analysisRepository.save({ analysis_id: analysisId, owner_user_id: user.user_id, account_id: account.account_id, status: "queued", artifact_id: artifactId, created_at: now, updated_at: now });
  jobRepository.save({ job_id: `job-${suffix}`, analysis_id: analysisId, account_id: account.account_id, job_type: "analysis_v1", status: "queued", retry_count: 0, created_at: now });
  return analysisId;
}

test.beforeEach(() => {
  resetDb();
  clearBenchmarkManifestCacheForTests();
});

test.after(() => {
  closeDbForTests();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("worker claims distinct queued jobs under concurrent lease attempts", async () => {
  await seedJob("a");
  await seedJob("b");
  const now = new Date().toISOString();
  const [first, second] = await Promise.all([
    jobRepository.claimNextQueued(now, { leaseMs: 60_000 }),
    jobRepository.claimNextQueued(now, { leaseMs: 60_000 }),
  ]);
  assert.ok(first?.job_id);
  assert.ok(second?.job_id);
  assert.notEqual(first?.job_id, second?.job_id);
});

test("benchmark manifest cache hits until cleared", async () => {
  const root = path.join(tempDir, "benchmarks");
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, "manifest.v1.yaml"), manifestYaml("rev-a"));
  process.env.BENCHMARK_PROVIDER = "local";
  process.env.INVARIANCE_BENCHMARK_LIBRARY_ROOT = root;

  const first = await loadBenchmarkManifest();
  fs.writeFileSync(path.join(root, "manifest.v1.yaml"), manifestYaml("rev-b"));
  const second = await loadBenchmarkManifest();
  assert.equal(first.revision, "rev-a");
  assert.equal(second.revision, "rev-a");
  assert.equal(getBenchmarkManifestCacheStatus().cached, true);

  clearBenchmarkManifestCacheForTests();
  const third = await loadBenchmarkManifest();
  assert.equal(third.revision, "rev-b");
});

test("production local benchmark provider emits warning", async () => {
  const root = path.join(tempDir, "benchmarks-warning");
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, "manifest.v1.yaml"), manifestYaml("rev-warning"));
  process.env.BENCHMARK_PROVIDER = "local";
  process.env.INVARIANCE_BENCHMARK_LIBRARY_ROOT = root;
  const previousEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  const logs: string[] = [];
  const originalLog = console.log;
  console.log = (message?: unknown) => { logs.push(String(message)); };
  try {
    await loadBenchmarkManifest();
  } finally {
    console.log = originalLog;
    process.env.NODE_ENV = previousEnv;
  }
  assert.ok(logs.some((line) => line.includes("benchmark.local_provider.production_warning")));
});

test("rate limit allows under limit and blocks over limit", async () => {
  process.env.RATE_LIMIT_AUTH_MAX = "2";
  const key = "ip:test";
  assert.equal((await checkRateLimit({ route: "signup", kind: "auth", key })).allowed, true);
  assert.equal((await checkRateLimit({ route: "signup", kind: "auth", key })).allowed, true);
  assert.equal((await checkRateLimit({ route: "signup", kind: "auth", key })).allowed, false);
  delete process.env.RATE_LIMIT_AUTH_MAX;
});

test("rate limit key prefers account and user identity over ip", () => {
  assert.equal(rateLimitKey({ accountId: "acct-1", userId: "user-1" }), "account:acct-1");
  assert.equal(rateLimitKey({ userId: "user-1" }), "user:user-1");
  assert.equal(rateLimitKey({ email: "USER@Example.com" }), "email:user@example.com");
});
