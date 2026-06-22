import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "invariance-phase23-"));
process.env.INVARIANCE_DB_PATH = path.join(tempDir, "test.sqlite");
process.env.DATABASE_PROVIDER = "sqlite";
process.env.ANALYSIS_QUEUE_PROVIDER = "db";
process.env.OBJECT_STORAGE_PROVIDER = "local";
process.env.INVARIANCE_STORAGE_ROOT = path.join(tempDir, "storage");
Object.assign(process.env, {
  NODE_ENV: "development",
  WORKER_MODE: "embedded",
  ALLOW_EMBEDDED_WORKERS: "true",
});

import { accountService } from "../src/lib/server/accounts/service";
import { artifactRepository } from "../src/lib/server/repositories/artifact-repository";
import { buildUploadObjectKey } from "../src/lib/server/storage/object-keys";
import { getObjectStorage, resetObjectStorageForTests } from "../src/lib/server/storage/object-storage";
import { createLocalSignedObjectUrl } from "../src/lib/server/storage/local-signed-urls";
import { assertWorkerRuntimeConfig, shouldRunEmbeddedWorkers } from "../src/lib/server/queue/runtime-config";
import { createAnalysisFromArtifact, getAnalysisStatus } from "../src/lib/server/services/analysis-service";
import { getDb, closeDbForTests } from "../src/lib/server/persistence/database";
import { resetAnalysisQueueForTests } from "../src/lib/server/queue/provider";

function resetDb() {
  getDb().exec(`
    DELETE FROM research_briefs;
    DELETE FROM program_clarification_sessions;
    DELETE FROM program_report_snapshots;
    DELETE FROM program_notes;
    DELETE FROM program_artifacts;
    DELETE FROM program_events;
    DELETE FROM program_members;
    DELETE FROM research_programs;
    DELETE FROM evidence_events;
    DELETE FROM export_jobs;
    DELETE FROM exports;
    DELETE FROM webhook_events;
    DELETE FROM analysis_jobs;
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

async function seedStoredArtifact(accountId: string, userId: string, artifactId: string) {
  const fileName = "trades.csv";
  const storageKey = buildUploadObjectKey({ accountId, artifactId, fileName });
  await getObjectStorage().putObject({
    bucket: "uploads",
    file_name: fileName,
    content_type: "text/csv",
    bytes: new TextEncoder().encode("timestamp,pnl\n2026-01-01,1\n"),
    storage_key: storageKey,
  });

  artifactRepository.save({
    artifact_id: artifactId,
    owner_user_id: userId,
    account_id: accountId,
    file_name: fileName,
    file_type: "text/csv",
    file_size_bytes: 32,
    storage_key: storageKey,
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
      strategy_metadata: { strategy_name: "Queued only", timeframe: "1H", market: "BTCUSD" },
      bundle_manifest: { market: "crypto" },
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

test.beforeEach(() => {
  resetAnalysisQueueForTests();
  resetObjectStorageForTests();
  resetDb();
  Object.assign(process.env, {
    NODE_ENV: "development",
    WORKER_MODE: "embedded",
    ALLOW_EMBEDDED_WORKERS: "true",
  });
});

test.after(() => {
  closeDbForTests();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("local object storage issues signed read URLs and keeps predictable storage keys", async () => {
  const { user, account } = await accountService.ensureUserAndAccount({ email: "storage@example.com" });
  const artifactId = "artifact-phase23";
  await seedStoredArtifact(account.account_id, user.user_id, artifactId);
  const artifact = artifactRepository.findById(artifactId);
  assert.ok(artifact);
  assert.match(artifact!.storage_key, new RegExp(`^uploads/${account.account_id}/${artifactId}/`));

  const signedUrl = await getObjectStorage().getSignedReadUrl?.(artifact!.storage_key, {
    expiresInSeconds: 60,
    fileName: artifact!.file_name,
    contentType: artifact!.file_type,
  });
  assert.ok(signedUrl);
  assert.match(signedUrl!, /^\/api\/object-storage\/signed\?/);

  const tokenized = createLocalSignedObjectUrl({
    storageKey: artifact!.storage_key,
    expiresAt: Date.now() + 60_000,
    fileName: artifact!.file_name,
    contentType: artifact!.file_type,
  });
  assert.match(tokenized, /^\/api\/object-storage\/signed\?/);
});

test("embedded workers are disabled outside development", async () => {
  Object.assign(process.env, {
    NODE_ENV: "production",
    WORKER_MODE: "external",
    ALLOW_EMBEDDED_WORKERS: "false",
  });
  assert.equal(shouldRunEmbeddedWorkers(), false);
  assert.equal(assertWorkerRuntimeConfig().mode, "external");

  process.env.WORKER_MODE = "embedded";
  assert.throws(() => assertWorkerRuntimeConfig(), /Embedded workers are disabled in production/);
});

test("web analysis creation enqueues only when production uses external workers", async () => {
  Object.assign(process.env, {
    NODE_ENV: "production",
    WORKER_MODE: "external",
    ALLOW_EMBEDDED_WORKERS: "false",
  });

  const { user, account } = await accountService.ensureUserAndAccount({ email: "queue-only@example.com" });
  await seedStoredArtifact(account.account_id, user.user_id, "artifact-queue-only");

  const created = await createAnalysisFromArtifact({
    artifact_id: "artifact-queue-only",
    owner_user_id: user.user_id,
    account_id: account.account_id,
  });

  await new Promise((resolve) => setTimeout(resolve, 25));
  const status = await getAnalysisStatus(created.analysis_id);
  assert.equal(status?.status, "queued");
  assert.equal(status?.job_status, "queued");
});
