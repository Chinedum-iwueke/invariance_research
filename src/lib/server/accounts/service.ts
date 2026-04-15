import type { PlanId, SubscriptionStatus } from "@/lib/contracts/account";
import { accountRepository, entitlementRepository, subscriptionRepository, usageRepository, userRepository } from "@/lib/server/accounts/repositories";
import { analysisRepository } from "@/lib/server/repositories/analysis-repository";
import { hashPassword, verifyPassword } from "@/lib/server/auth/passwords";

function monthBucket(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export const accountService = {
  ensureUserAndAccount(input: { email: string; name?: string }) {
    let user = userRepository.findByEmail(input.email);
    if (!user) {
      user = userRepository.save(input);
    }

    let account = accountRepository.findByOwnerUserId(user.user_id);
    if (!account) {
      account = accountRepository.save(user.user_id, "explorer");
    }

    return { user, account };
  },

  createUserAndAccountWithPassword(input: { email: string; name?: string; password: string }) {
    const email = input.email.trim().toLowerCase();
    if (!email) {
      throw new Error("email_required");
    }
    if (userRepository.findByEmail(email)) {
      throw new Error("email_already_registered");
    }

    const user = userRepository.save({
      email,
      name: input.name,
      password_hash: hashPassword(input.password),
    });
    const account = accountRepository.save(user.user_id, "explorer");
    return { user, account };
  },

  authenticateWithPassword(input: { email: string; password: string }) {
    const email = input.email.trim().toLowerCase();
    if (!email || !input.password) return undefined;

    const user = userRepository.findByEmail(email);
    if (!user || !verifyPassword(input.password, user.password_hash)) {
      return undefined;
    }

    const account = accountRepository.findByOwnerUserId(user.user_id);
    if (!account) return undefined;

    this.recordLogin(user.user_id);
    return { user, account };
  },

  setPasswordForEmail(input: { email: string; password: string }) {
    const email = input.email.trim().toLowerCase();
    const user = userRepository.findByEmail(email);
    if (!user) {
      throw new Error("user_not_found");
    }

    userRepository.updatePassword(user.user_id, hashPassword(input.password));
    return { user_id: user.user_id, email: user.email };
  },

  recordLogin(userId: string) {
    userRepository.touchLogin(userId);
  },

  getAccountState(accountId: string) {
    const account = accountRepository.findById(accountId);
    if (!account) return undefined;
    const entitlements = entitlementRepository.get(accountId);
    const subscription = subscriptionRepository.findByAccountId(accountId);
    return { account, entitlements, subscription };
  },

  getUsage(accountId: string) {
    const now = new Date();
    const bucket = monthBucket(now);
    const usage = usageRepository.get(accountId, bucket);
    const completedAnalyses = analysisRepository.countCompletedForMonth(accountId, bucket);
    return { ...usage, analyses_created: completedAnalyses };
  },

  incrementUsage(accountId: string, kind: "analysis" | "upload" | "export") {
    return usageRepository.increment({ account_id: accountId, kind });
  },

  applySubscription(input: {
    account_id: string;
    provider_customer_id: string;
    provider_subscription_id: string;
    plan_id: PlanId;
    status: SubscriptionStatus;
    current_period_start?: string;
    current_period_end?: string;
    cancel_at_period_end?: boolean;
  }) {
    subscriptionRepository.upsert({
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

    accountRepository.updatePlan(input.account_id, input.plan_id, input.status);
  },
};
