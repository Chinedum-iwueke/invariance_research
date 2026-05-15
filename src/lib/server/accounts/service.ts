import type { PlanId, SubscriptionStatus } from "@/lib/contracts/account";
import type { User } from "@/lib/contracts/account";
import { hashPassword, verifyPassword } from "@/lib/server/auth/passwords";
import { authTokenRepository, generateAuthToken, hashAuthToken } from "@/lib/server/auth/tokens";
import { sendTransactionalEmail } from "@/lib/server/email/email-service";
import { getCoreRepositories } from "@/lib/server/persistence/repositories";

function monthBucket(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function ensureDefaultUsageSnapshot(accountId: string) {
  const repositories = getCoreRepositories();
  await repositories.usage.increment({ account_id: accountId, kind: "analysis", increment: 0 });
}

function appUrl() {
  return (process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
}

function hoursFromNow(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

async function sendVerificationEmail(user: User) {
  const { token, tokenHash } = generateAuthToken();
  await authTokenRepository.consumeOutstanding(user.user_id, "email_verification");
  await authTokenRepository.create({ userId: user.user_id, purpose: "email_verification", tokenHash, expiresAt: hoursFromNow(24) });
  const link = `${appUrl()}/account/verify-email?token=${encodeURIComponent(token)}`;
  await sendTransactionalEmail({
    to: user.email,
    kind: "email_verification",
    subject: "Verify your Invariance Research account",
    text: `Verify your Invariance Research account: ${link}`,
    html: `<p>Verify your Invariance Research account.</p><p><a href="${link}">Verify email</a></p>`,
    devLink: link,
  });
}

async function sendPasswordResetEmail(user: User) {
  const { token, tokenHash } = generateAuthToken();
  await authTokenRepository.consumeOutstanding(user.user_id, "password_reset");
  await authTokenRepository.create({ userId: user.user_id, purpose: "password_reset", tokenHash, expiresAt: hoursFromNow(2) });
  const link = `${appUrl()}/account/reset-password?token=${encodeURIComponent(token)}`;
  await sendTransactionalEmail({
    to: user.email,
    kind: "password_reset",
    subject: "Reset your Invariance Research password",
    text: `Reset your Invariance Research password: ${link}`,
    html: `<p>Reset your Invariance Research password.</p><p><a href="${link}">Reset password</a></p>`,
    devLink: link,
  });
}

export const accountService = {
  async ensureUserAndAccount(input: { email: string; name?: string; emailVerified?: boolean }) {
    const repositories = getCoreRepositories();
    let user = await repositories.users.findByEmail(input.email);
    if (!user) {
      user = await repositories.users.save({
        email: input.email,
        name: input.name,
        email_verified_at: input.emailVerified ? new Date().toISOString() : undefined,
      });
    } else if (input.emailVerified && !user.email_verified_at) {
      await repositories.users.markEmailVerified(user.user_id);
      user = await repositories.users.findById(user.user_id) ?? user;
    }

    let account = await repositories.accounts.findByOwnerUserId(user.user_id);
    if (!account) {
      account = await repositories.accounts.save(user.user_id, "explorer");
    }
    await ensureDefaultUsageSnapshot(account.account_id);

    return { user, account };
  },

  async ensureAccountForUserId(userId: string) {
    const repositories = getCoreRepositories();
    const user = await repositories.users.findById(userId);
    if (!user) return undefined;

    let account = await repositories.accounts.findByOwnerUserId(user.user_id);
    if (!account) {
      account = await repositories.accounts.save(user.user_id, "explorer");
    }
    await ensureDefaultUsageSnapshot(account.account_id);
    return { user, account };
  },

  async createUserAndAccountWithPassword(input: { email: string; name?: string; password: string }) {
    const repositories = getCoreRepositories();
    const email = input.email.trim().toLowerCase();
    if (!email) {
      throw new Error("email_required");
    }
    if (await repositories.users.findByEmail(email)) {
      throw new Error("email_already_registered");
    }

    const user = await repositories.users.save({
      email,
      name: input.name,
      password_hash: hashPassword(input.password),
    });
    const account = await repositories.accounts.save(user.user_id, "explorer");
    await ensureDefaultUsageSnapshot(account.account_id);
    await sendVerificationEmail(user);
    return { user, account };
  },

  async authenticateWithPassword(input: { email: string; password: string }) {
    const repositories = getCoreRepositories();
    const email = input.email.trim().toLowerCase();
    if (!email || !input.password) return undefined;

    const user = await repositories.users.findByEmail(email);
    if (!user || !verifyPassword(input.password, user.password_hash) || !user.email_verified_at) {
      return undefined;
    }

    let account = await repositories.accounts.findByOwnerUserId(user.user_id);
    if (!account) {
      account = await repositories.accounts.save(user.user_id, "explorer");
    }
    await ensureDefaultUsageSnapshot(account.account_id);

    await this.recordLogin(user.user_id);
    return { user, account };
  },

  async setPasswordForEmail(input: { email: string; password: string }) {
    const repositories = getCoreRepositories();
    const email = input.email.trim().toLowerCase();
    const user = await repositories.users.findByEmail(email);
    if (!user) {
      throw new Error("user_not_found");
    }

    await repositories.users.updatePassword(user.user_id, hashPassword(input.password));
    await repositories.users.incrementSessionVersion(user.user_id);
    return { user_id: user.user_id, email: user.email };
  },

  async resendVerificationEmail(input: { email: string }) {
    const repositories = getCoreRepositories();
    const user = await repositories.users.findByEmail(input.email.trim().toLowerCase());
    if (!user || user.email_verified_at || !user.password_hash) return { ok: true };
    await sendVerificationEmail(user);
    return { ok: true };
  },

  async verifyEmailToken(token: string) {
    const repositories = getCoreRepositories();
    const record = await authTokenRepository.findActiveByHash(hashAuthToken(token), "email_verification");
    if (!record) return { ok: false as const, reason: "invalid_or_expired" as const };
    await repositories.users.markEmailVerified(record.user_id);
    await authTokenRepository.consume(record.token_id);
    return { ok: true as const };
  },

  async requestPasswordReset(input: { email: string }) {
    const repositories = getCoreRepositories();
    const user = await repositories.users.findByEmail(input.email.trim().toLowerCase());
    if (user?.password_hash) {
      await sendPasswordResetEmail(user);
    }
    return { ok: true };
  },

  async resetPassword(input: { token: string; password: string }) {
    const repositories = getCoreRepositories();
    const record = await authTokenRepository.findActiveByHash(hashAuthToken(input.token), "password_reset");
    if (!record) return { ok: false as const, reason: "invalid_or_expired" as const };
    await repositories.users.updatePassword(record.user_id, hashPassword(input.password));
    await repositories.users.incrementSessionVersion(record.user_id);
    await authTokenRepository.consumeOutstanding(record.user_id, "password_reset");
    return { ok: true as const };
  },

  async recordLogin(userId: string) {
    await getCoreRepositories().users.touchLogin(userId);
  },

  async getAccountState(accountId: string) {
    const repositories = getCoreRepositories();
    const account = await repositories.accounts.findById(accountId);
    if (!account) return undefined;
    const entitlements = await repositories.entitlements.get(accountId);
    const subscription = await repositories.subscriptions.findByAccountId(accountId);
    return { account, entitlements, subscription };
  },

  async getUsage(accountId: string) {
    const repositories = getCoreRepositories();
    const now = new Date();
    const bucket = monthBucket(now);
    const usage = await repositories.usage.get(accountId, bucket);
    const completedAnalyses = await repositories.analyses.countCompletedForMonth(accountId, bucket);
    return { ...usage, analyses_created: completedAnalyses };
  },

  async incrementUsage(accountId: string, kind: "analysis" | "upload" | "export") {
    return getCoreRepositories().usage.increment({ account_id: accountId, kind });
  },

  async applySubscription(input: {
    account_id: string;
    provider_customer_id: string;
    provider_subscription_id: string;
    plan_id: PlanId;
    status: SubscriptionStatus;
    current_period_start?: string;
    current_period_end?: string;
    cancel_at_period_end?: boolean;
  }) {
    const repositories = getCoreRepositories();
    await repositories.subscriptions.upsert({
      subscription_id: `${input.account_id}:${input.provider_subscription_id}`,
      account_id: input.account_id,
      provider: "stripe",
      provider_customer_id: input.provider_customer_id,
      provider_subscription_id: input.provider_subscription_id,
      plan_id: input.plan_id,
      status: input.status,
      current_period_start: input.current_period_start,
      current_period_end: input.current_period_end,
      cancel_at_period_end: Boolean(input.cancel_at_period_end),
    });

    await repositories.accounts.updatePlan(input.account_id, input.plan_id, input.status);
  },
};
