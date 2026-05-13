import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "invariance-phase9-"));
process.env.INVARIANCE_DB_PATH = path.join(tempDir, "test.sqlite");
process.env.ADMIN_EMAILS = "admin@example.com";

import { accountService } from "../src/lib/server/accounts/service";
import { artifactRepository } from "../src/lib/server/repositories/artifact-repository";
import { analysisRepository } from "../src/lib/server/repositories/analysis-repository";
import { assertUsageWithinPlan } from "../src/lib/server/entitlements/usage";
import { createAnalysisFromArtifact } from "../src/lib/server/services/analysis-service";
import { getAppSecondaryItems } from "../src/lib/app/navigation";
import { authConfig, getMissingAuthEnvVars, provisionGoogleOAuthUser } from "../src/lib/server/auth/auth";
import { getDb, closeDbForTests } from "../src/lib/server/persistence/database";

function resetDb() {
  const db = getDb();
  db.exec(`
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
  artifactRepository.save({
    artifact_id: artifactId,
    owner_user_id: userId,
    account_id: accountId,
    file_name: "trades.csv",
    file_type: "text/csv",
    file_size_bytes: 120,
    storage_key: `uploads/${artifactId}.csv`,
    checksum_sha256: "test-checksum",
    artifact_kind: "trade_csv",
    richness: "trade_only",
    uploaded_at: new Date().toISOString(),
    parsed_artifact: {
      artifact_id: artifactId,
      artifact_type: "generic_trade_csv",
      artifact_kind: "trade_csv",
      richness: "trade_only",
      parser_notes: [],
      strategy_metadata: { strategy_name: "Test", timeframe: "1H", market: "BTCUSD" },
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

async function createAndMark(accountId: string, userId: string, artifactId: string, status: "completed" | "failed" | "processing") {
  seedArtifact(accountId, userId, artifactId);
  const created = await createAnalysisFromArtifact({ artifact_id: artifactId, owner_user_id: userId, account_id: accountId });
  analysisRepository.update(created.analysis_id, (current) => ({ ...current, status, updated_at: new Date().toISOString() }));
  return created;
}

test.beforeEach(() => resetDb());
test.after(() => {
  closeDbForTests();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("failed and processing analyses do not consume monthly quota", async () => {
  const { user, account } = await accountService.ensureUserAndAccount({ email: "trial@example.com" });

  await createAndMark(account.account_id, user.user_id, "artifact-f1", "failed");
  await createAndMark(account.account_id, user.user_id, "artifact-f2", "failed");
  await createAndMark(account.account_id, user.user_id, "artifact-p1", "processing");

  const usage = await accountService.getUsage(account.account_id);
  assert.equal(usage.analyses_created, 0);
  await assert.doesNotReject(() => assertUsageWithinPlan(account.account_id));
});

test("completed analyses consume quota and enforce cap", async () => {
  const { user, account } = await accountService.ensureUserAndAccount({ email: "quota@example.com" });

  await createAndMark(account.account_id, user.user_id, "artifact-c1", "completed");
  await createAndMark(account.account_id, user.user_id, "artifact-c2", "completed");
  await createAndMark(account.account_id, user.user_id, "artifact-c3", "completed");

  const usage = await accountService.getUsage(account.account_id);
  assert.equal(usage.analyses_created, 3);
  await assert.rejects(() => assertUsageWithinPlan(account.account_id), /monthly_analysis_limit_reached/);
});

test("admin accounts bypass run cap", async () => {
  const { user, account } = await accountService.ensureUserAndAccount({ email: "admin@example.com" });
  await createAndMark(account.account_id, user.user_id, "artifact-a1", "completed");
  await createAndMark(account.account_id, user.user_id, "artifact-a2", "completed");
  await createAndMark(account.account_id, user.user_id, "artifact-a3", "completed");
  await createAndMark(account.account_id, user.user_id, "artifact-a4", "completed");

  await assert.doesNotReject(() => assertUsageWithinPlan(account.account_id));
});

test("admin nav item only appears for admin users", () => {
  assert.equal(getAppSecondaryItems(false).some((item) => item.label === "Admin Ops"), false);
  assert.equal(getAppSecondaryItems(true).some((item) => item.label === "Admin Ops"), true);
});

test("auth session config persists login and jwt/session callbacks preserve identity across navigation", async () => {
  assert.equal(authConfig.session.strategy, "jwt");
  assert.equal(authConfig.session.maxAge, 60 * 60 * 24 * 30);

  const token = await authConfig.callbacks.jwt!({ token: {}, user: { id: "u-1", email: "user@example.com", account_id: "acct-1" } as any } as any);
  const session = await authConfig.callbacks.session!({ session: { user: { email: "user@example.com" } }, token } as any);

  assert.equal(session.user.id, "u-1");
  assert.equal(session.user.account_id, "acct-1");
});

test("google oauth provisioning creates internal user/account and a valid session token", async () => {
  const provisioned = await provisionGoogleOAuthUser({ email: "Google.User@Example.com", name: "Google User" });

  const userRow = getDb().prepare("SELECT * FROM users WHERE email = ?").get("google.user@example.com") as { user_id: string; email: string; last_login_at: string };
  const accountRow = getDb().prepare("SELECT * FROM accounts WHERE owner_user_id = ?").get(provisioned.user.user_id) as { account_id: string; owner_user_id: string };

  assert.equal(userRow.user_id, provisioned.user.user_id);
  assert.equal(accountRow.account_id, provisioned.account.account_id);

  const token = await authConfig.callbacks.jwt!({
    token: {},
    user: {
      id: provisioned.user.user_id,
      email: provisioned.user.email,
      name: provisioned.user.name,
      account_id: provisioned.account.account_id,
    } as any,
  } as any);
  const session = await authConfig.callbacks.session!({ session: { user: { email: provisioned.user.email } }, token } as any);

  assert.equal(session.user.id, provisioned.user.user_id);
  assert.equal(session.user.account_id, provisioned.account.account_id);
});

test("google oauth provisioning failure is controlled when email is missing", async () => {
  await assert.rejects(() => provisionGoogleOAuthUser({ email: undefined, name: "No Email" }), /oauth_email_required/);
});

test("auth env validation requires app, nextauth, secret, and google oauth settings", () => {
  assert.deepEqual(
    getMissingAuthEnvVars({
      NEXTAUTH_URL: "https://example.com",
      APP_URL: "https://example.com",
      AUTH_SECRET: "secret",
      GOOGLE_CLIENT_ID: "google-client-id",
      GOOGLE_CLIENT_SECRET: "google-client-secret",
    } as NodeJS.ProcessEnv),
    [],
  );

  assert.deepEqual(getMissingAuthEnvVars({} as NodeJS.ProcessEnv), [
    "NEXTAUTH_URL",
    "APP_URL",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "NEXTAUTH_SECRET/AUTH_SECRET",
  ]);
});

test("auth redirect callback normalizes post-logout and cross-site redirects", async () => {
  const baseUrl = "https://invarianceresearch.com";
  const local = await authConfig.callbacks.redirect!({ url: "/app", baseUrl } as any);
  const sameOrigin = await authConfig.callbacks.redirect!({ url: `${baseUrl}/pricing`, baseUrl } as any);
  const offsite = await authConfig.callbacks.redirect!({ url: "https://evil.example", baseUrl } as any);

  assert.equal(local, `${baseUrl}/app`);
  assert.equal(sameOrigin, `${baseUrl}/pricing`);
  assert.equal(offsite, baseUrl);
});
