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
import { authTokenRepository, generateAuthToken, hashAuthToken } from "../src/lib/server/auth/tokens";
import { assignUserRole } from "../src/lib/server/admin/roles";
import { isAdminIdentity } from "../src/lib/server/admin/guards";
import { listAdminAuditLog, writeAdminAuditLog } from "../src/lib/server/admin/audit-log";
import { getDb, closeDbForTests } from "../src/lib/server/persistence/database";

function resetDb() {
  const db = getDb();
  db.exec(`
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

test("settings appears once real account controls exist", () => {
  assert.equal(getAppSecondaryItems(false).some((item) => item.href === "/app/settings"), true);
  assert.equal(getAppSecondaryItems(true).some((item) => item.href === "/app/settings"), true);
});

test("signup creates unverified password user and blocks credentials until verification", async () => {
  const created = await accountService.createUserAndAccountWithPassword({
    email: "verify@example.com",
    password: "StrongPass123",
  });

  const row = getDb().prepare("SELECT email_verified_at FROM users WHERE user_id = ?").get(created.user.user_id) as { email_verified_at: string | null };
  assert.equal(row.email_verified_at, null);
  assert.equal(await accountService.authenticateWithPassword({ email: "verify@example.com", password: "StrongPass123" }), undefined);

  const tokenRow = getDb().prepare("SELECT token_hash FROM auth_tokens WHERE user_id = ? AND purpose = ? AND consumed_at IS NULL").get(created.user.user_id, "email_verification") as { token_hash: string } | undefined;
  assert.ok(tokenRow?.token_hash);
});

test("verification token validates once and expired token is rejected", async () => {
  const { user } = await accountService.createUserAndAccountWithPassword({ email: "token@example.com", password: "StrongPass123" });
  const { token, tokenHash } = generateAuthToken();
  await authTokenRepository.create({ userId: user.user_id, purpose: "email_verification", tokenHash, expiresAt: new Date(Date.now() + 60_000).toISOString() });

  const verified = await accountService.verifyEmailToken(token);
  assert.equal(verified.ok, true);
  const updated = getDb().prepare("SELECT email_verified_at FROM users WHERE user_id = ?").get(user.user_id) as { email_verified_at: string | null };
  assert.ok(updated.email_verified_at);
  assert.equal((await accountService.verifyEmailToken(token)).ok, false);

  const expired = generateAuthToken();
  await authTokenRepository.create({ userId: user.user_id, purpose: "email_verification", tokenHash: expired.tokenHash, expiresAt: new Date(Date.now() - 60_000).toISOString() });
  assert.equal((await accountService.verifyEmailToken(expired.token)).ok, false);
});

test("resend verification replaces outstanding verification token", async () => {
  const { user } = await accountService.createUserAndAccountWithPassword({ email: "resend@example.com", password: "StrongPass123" });
  await accountService.resendVerificationEmail({ email: user.email });
  const rows = getDb().prepare("SELECT consumed_at FROM auth_tokens WHERE user_id = ? AND purpose = ?").all(user.user_id, "email_verification") as Array<{ consumed_at: string | null }>;
  assert.equal(rows.filter((row) => !row.consumed_at).length, 1);
  assert.ok(rows.some((row) => row.consumed_at));
});

test("forgot and reset password flow is neutral and invalidates old password", async () => {
  const { user } = await accountService.createUserAndAccountWithPassword({ email: "reset@example.com", password: "StrongPass123" });
  getDb().prepare("UPDATE users SET email_verified_at = ? WHERE user_id = ?").run(new Date().toISOString(), user.user_id);

  assert.deepEqual(await accountService.requestPasswordReset({ email: "missing@example.com" }), { ok: true });
  assert.deepEqual(await accountService.requestPasswordReset({ email: "reset@example.com" }), { ok: true });

  const { token, tokenHash } = generateAuthToken();
  await authTokenRepository.create({ userId: user.user_id, purpose: "password_reset", tokenHash, expiresAt: new Date(Date.now() + 60_000).toISOString() });
  assert.equal((await accountService.resetPassword({ token, password: "NewStrongPass123" })).ok, true);
  assert.equal(await accountService.authenticateWithPassword({ email: "reset@example.com", password: "StrongPass123" }), undefined);
  assert.ok(await accountService.authenticateWithPassword({ email: "reset@example.com", password: "NewStrongPass123" }));
});

test("google oauth verified email is marked verified", async () => {
  const provisioned = await provisionGoogleOAuthUser({ email: "verified.google@example.com", name: "Verified Google", emailVerified: true });
  const row = getDb().prepare("SELECT email_verified_at FROM users WHERE user_id = ?").get(provisioned.user.user_id) as { email_verified_at: string | null };
  assert.ok(row.email_verified_at);
});

test("admin bootstrap and db-backed admin roles authorize without persistent allowlist dependence", async () => {
  const { user } = await accountService.ensureUserAndAccount({ email: "admin@example.com" });
  assert.equal(await isAdminIdentity({ user_id: user.user_id, email: user.email }), true);
  const role = getDb().prepare("SELECT role FROM user_roles WHERE user_id = ?").get(user.user_id) as { role: string } | undefined;
  assert.equal(role?.role, "owner");

  process.env.ADMIN_EMAILS = "";
  const { user: dbAdmin } = await accountService.ensureUserAndAccount({ email: "db-admin@example.com" });
  await assignUserRole({ userId: dbAdmin.user_id, role: "admin", createdBy: user.user_id });
  assert.equal(await isAdminIdentity({ user_id: dbAdmin.user_id, email: dbAdmin.email }), true);
  const { user: normal } = await accountService.ensureUserAndAccount({ email: "normal@example.com" });
  assert.equal(await isAdminIdentity({ user_id: normal.user_id, email: normal.email }), false);
  process.env.ADMIN_EMAILS = "admin@example.com";
});

test("audit log records admin action metadata without token material", async () => {
  const { user } = await accountService.ensureUserAndAccount({ email: "auditor@example.com" });
  await writeAdminAuditLog({
    actor: { user_id: user.user_id, email: user.email },
    action: "role.change",
    resourceType: "user",
    resourceId: "target-user",
    metadata: { role: "admin", token_hash: hashAuthToken("not-logged-token") },
  });
  const rows = await listAdminAuditLog();
  assert.equal(rows[0]?.action, "role.change");
  assert.equal(rows[0]?.resource_type, "user");
  assert.equal((rows[0]?.metadata as any).role, "admin");
  assert.doesNotMatch(JSON.stringify(rows[0]), /not-logged-token/);
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
