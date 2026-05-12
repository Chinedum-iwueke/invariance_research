import type { PlanId, SubscriptionStatus } from "@/lib/contracts/account";
import { hashPassword, verifyPassword } from "@/lib/server/auth/passwords";
import { getCoreRepositories } from "@/lib/server/persistence/repositories";

function monthBucket(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function ensureDefaultUsageSnapshot(accountId: string) {
  const repositories = getCoreRepositories();
  await repositories.usage.increment({ account_id: accountId, kind: "analysis", increment: 0 });
}

export const accountService = {
  async ensureUserAndAccount(input: { email: string; name?: string }) {
    const repositories = getCoreRepositories();
    let user = await repositories.users.findByEmail(input.email);
    if (!user) {
      user = await repositories.users.save(input);
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
    return { user, account };
  },

  async authenticateWithPassword(input: { email: string; password: string }) {
    const repositories = getCoreRepositories();
    const email = input.email.trim().toLowerCase();
    if (!email || !input.password) return undefined;

    const user = await repositories.users.findByEmail(email);
    if (!user || !verifyPassword(input.password, user.password_hash)) {
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
    return { user_id: user.user_id, email: user.email };
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
