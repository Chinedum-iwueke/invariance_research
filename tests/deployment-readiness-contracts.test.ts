import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "invariance-deploy-contracts-"));
process.env.INVARIANCE_DB_PATH = path.join(tempDir, "test.sqlite");
process.env.DATABASE_PROVIDER = "sqlite";
process.env.ANALYSIS_QUEUE_PROVIDER = "db";
process.env.OBJECT_STORAGE_PROVIDER = "local";
process.env.INVARIANCE_STORAGE_ROOT = path.join(tempDir, "storage");

import { accountService } from "../src/lib/server/accounts/service";
import { analysisRepository } from "../src/lib/server/repositories/analysis-repository";
import { artifactRepository } from "../src/lib/server/repositories/artifact-repository";
import { jobRepository } from "../src/lib/server/repositories/job-repository";
import { getAnalysisQueue, getQueueProvider, resetAnalysisQueueForTests } from "../src/lib/server/queue/provider";
import { getObjectStorage, getObjectStorageProvider } from "../src/lib/server/storage/object-storage";
import { getDatabaseProvider, closeDbForTests, getDb } from "../src/lib/server/persistence/database";

function resetDb() {
  getDb().exec(`
    DELETE FROM export_jobs;
    DELETE FROM exports;
    DELETE FROM webhook_events;
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

function seedArtifact(accountId: string, userId: string, artifactId: string) {
  return artifactRepository.save({
    artifact_id: artifactId,
    owner_user_id: userId,
    account_id: accountId,
    file_name: "trades.csv",
    file_type: "text/csv",
    file_size_bytes: 120,
    storage_key: "uploads/trades.csv",
    checksum_sha256: "checksum",
    artifact_kind: "trade_csv",
    richness: "trade_only",
    uploaded_at: "2026-01-01T00:00:00.000Z",
    parsed_artifact: {
      artifact_id: artifactId,
      artifact_type: "generic_trade_csv",
      artifact_kind: "trade_csv",
      richness: "trade_only",
      parser_notes: [],
      trades: [],
      validation: { valid: true, errors: [] },
    } as any,
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
    } as any,
  });
}

function seedAnalysisLifecycle(id = "analysis-contract-1") {
  const { user, account } = accountService.ensureUserAndAccount({ email: `${id}@example.com` });
  const artifact = seedArtifact(account.account_id, user.user_id, `${id}-artifact`);
  const now = "2026-01-01T00:00:00.000Z";
  analysisRepository.save({
    analysis_id: id,
    owner_user_id: user.user_id,
    account_id: account.account_id,
    status: "queued",
    artifact_id: artifact.artifact_id,
    created_at: now,
    updated_at: now,
    eligibility_snapshot: artifact.eligibility_summary,
  });
  artifactRepository.attachAnalysis(artifact.artifact_id, id);
  jobRepository.save({
    job_id: `${id}-job`,
    analysis_id: id,
    account_id: account.account_id,
    job_type: "analysis_v1",
    status: "queued",
    progress_pct: 0,
    current_step: "Queued",
    created_at: now,
    updated_at: now,
    retry_count: 0,
    attempts: 0,
    max_attempts: 2,
    available_at: now,
  });
  return { user, account, artifact, analysisId: id, jobId: `${id}-job` };
}

test.beforeEach(() => {
  resetAnalysisQueueForTests();
  resetDb();
});

test.after(() => {
  closeDbForTests();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("provider selection stays explicit for db, queue, and object storage", async () => {
  assert.equal(getDatabaseProvider(), "sqlite");
  assert.equal(getQueueProvider(), "db");
  assert.equal(getObjectStorageProvider(), "local");
  const stored = await getObjectStorage().putObject({ bucket: "uploads", file_name: "a.csv", content_type: "text/csv", bytes: new TextEncoder().encode("a,b") });
  assert.equal(await getObjectStorage().objectExists(stored.storage_key), true);
  assert.equal(stored.content_type, "text/csv");
  assert.equal(stored.size_bytes, 3);
});

test("Postgres mode prevents accidental SQLite access", () => {
  process.env.DATABASE_PROVIDER = "postgres";
  assert.equal(getDatabaseProvider(), "postgres");
  assert.throws(() => getDb(), /DATABASE_PROVIDER=postgres/);
  process.env.DATABASE_PROVIDER = "sqlite";
});

test("analysis lifecycle contract covers create, enqueue, atomic lease, metadata persist, and complete", async () => {
  const { analysisId, jobId } = seedAnalysisLifecycle();
  const queue = getAnalysisQueue();

  queue.enqueue({ analysisId, availableAt: "2026-01-01T00:00:00.000Z" });
  const firstClaim = await queue.lease({ nowIso: "2026-01-01T00:00:01.000Z", leaseMs: 60_000, workerId: "worker-a" });
  const secondClaim = await queue.lease({ nowIso: "2026-01-01T00:00:01.000Z", leaseMs: 60_000, workerId: "worker-b" });
  assert.equal(firstClaim?.job_id, jobId);
  assert.equal(secondClaim, undefined);

  jobRepository.updateByAnalysisId(analysisId, (current) => ({ ...current, status: "running", current_step: "Running", progress_pct: 50 }));
  analysisRepository.update(analysisId, (current) => ({
    ...current,
    status: "completed",
    result: { analysis_id: analysisId, generated_at: "2026-01-01T00:00:02.000Z" } as any,
    updated_at: "2026-01-01T00:00:02.000Z",
  }));
  queue.complete({ analysisId });

  const analysis = analysisRepository.findById(analysisId);
  const status = queue.getJobStatus(jobId);
  assert.equal(analysis?.status, "completed");
  assert.ok(analysis?.result);
  assert.equal(status?.status, "completed");
});

test("expired leases are reclaimable, failed jobs retry, and max attempts dead-letter", async () => {
  const { analysisId, jobId } = seedAnalysisLifecycle("analysis-contract-failure");
  const queue = getAnalysisQueue();

  const first = await queue.lease({ nowIso: "2026-01-01T00:00:01.000Z", leaseMs: 1_000 });
  assert.equal(first?.job_id, jobId);
  const reclaimed = await queue.lease({ nowIso: "2026-01-01T00:00:03.000Z", leaseMs: 1_000 });
  assert.equal(reclaimed?.job_id, jobId);

  jobRepository.updateByAnalysisId(analysisId, (current) => ({
    ...current,
    status: "failed",
    error_code: "engine_execution_failed",
    error_message: "boom",
    last_error: "boom",
  }));
  queue.retry({ analysisId, retryCount: 1, availableAt: "2026-01-01T00:00:04.000Z", lastError: "boom" });
  assert.equal(queue.getJobStatus(jobId)?.status, "queued");

  queue.retry({ analysisId, retryCount: 2, availableAt: "2026-01-01T00:00:05.000Z", lastError: "boom again" });
  assert.equal(queue.getJobStatus(jobId)?.status, "dead_letter");
  assert.equal(queue.listDeadLetters().length, 1);
});

test("enqueue is idempotent for an existing analysis job", () => {
  const { analysisId, jobId } = seedAnalysisLifecycle("analysis-contract-idempotent");
  const queue = getAnalysisQueue();
  queue.enqueue({ analysisId });
  queue.enqueue({ analysisId });
  assert.equal(queue.getJobStatus(jobId)?.job_id, jobId);
});
