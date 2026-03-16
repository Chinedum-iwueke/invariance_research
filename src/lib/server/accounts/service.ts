import type { PlanId, SubscriptionStatus } from "@/lib/contracts/account";
import { accountRepository, entitlementRepository, subscriptionRepository, usageRepository, userRepository } from "@/lib/server/accounts/repositories";

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
    const bucket = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    return usageRepository.get(accountId, bucket);
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
