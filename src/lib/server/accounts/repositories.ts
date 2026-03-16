import { randomUUID } from "node:crypto";
import type { Account, PlanId, Subscription, User } from "@/lib/contracts/account";
import type { EntitlementSnapshot, UsageSnapshot } from "@/lib/contracts/entitlements";
import type { UsageInput, UsageRepository } from "@/lib/server/accounts/models";
import { resolveEntitlementsForPlan } from "@/lib/server/entitlements/entitlements";

const usersById = new Map<string, User>();
const usersByEmail = new Map<string, User>();
const accountsById = new Map<string, Account>();
const accountByOwner = new Map<string, Account>();
const subscriptionsByAccountId = new Map<string, Subscription>();
const entitlementByAccountId = new Map<string, EntitlementSnapshot>();
const usageByAccountMonth = new Map<string, UsageSnapshot>();

function monthBucket(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export const userRepository = {
  findByEmail(email: string) {
    return usersByEmail.get(email.toLowerCase());
  },
  save(input: { email: string; name?: string }) {
    const now = new Date().toISOString();
    const user: User = {
      user_id: randomUUID(),
      email: input.email.toLowerCase(),
      name: input.name,
      created_at: now,
      last_login_at: now,
    };
    usersById.set(user.user_id, user);
    usersByEmail.set(user.email, user);
    return user;
  },
  touchLogin(userId: string) {
    const user = usersById.get(userId);
    if (!user) return;
    user.last_login_at = new Date().toISOString();
    usersById.set(userId, user);
    usersByEmail.set(user.email, user);
  },
};

export const accountRepository = {
  findByOwnerUserId(ownerUserId: string) {
    return accountByOwner.get(ownerUserId);
  },
  findById(accountId: string) {
    return accountsById.get(accountId);
  },
  save(ownerUserId: string, planId: PlanId = "explorer") {
    const now = new Date().toISOString();
    const account: Account = {
      account_id: randomUUID(),
      owner_user_id: ownerUserId,
      plan_id: planId,
      subscription_status: "trialing",
      created_at: now,
      updated_at: now,
    };
    accountsById.set(account.account_id, account);
    accountByOwner.set(ownerUserId, account);
    entitlementByAccountId.set(account.account_id, resolveEntitlementsForPlan(account.account_id, planId, "plan_matrix"));
    return account;
  },
  updatePlan(accountId: string, planId: PlanId, status: Account["subscription_status"]) {
    const account = accountsById.get(accountId);
    if (!account) return;
    account.plan_id = planId;
    account.subscription_status = status;
    account.updated_at = new Date().toISOString();
    accountsById.set(accountId, account);
    entitlementByAccountId.set(accountId, resolveEntitlementsForPlan(accountId, planId, "stripe_webhook"));
    return account;
  },
};

export const subscriptionRepository = {
  upsert(subscription: Subscription) {
    subscriptionsByAccountId.set(subscription.account_id, subscription);
    return subscription;
  },
  findByAccountId(accountId: string) {
    return subscriptionsByAccountId.get(accountId);
  },
};

export const entitlementRepository = {
  get(accountId: string) {
    return entitlementByAccountId.get(accountId) ?? resolveEntitlementsForPlan(accountId, "explorer", "plan_matrix");
  },
  set(snapshot: EntitlementSnapshot) {
    entitlementByAccountId.set(snapshot.account_id, snapshot);
    return snapshot;
  },
};

export const usageRepository: UsageRepository = {
  get(accountId, bucket) {
    return (
      usageByAccountMonth.get(`${accountId}:${bucket}`) ?? {
        account_id: accountId,
        month_bucket: bucket,
        analyses_created: 0,
        artifacts_uploaded: 0,
        report_exports: 0,
      }
    );
  },
  increment(input: UsageInput) {
    const bucket = monthBucket(input.at ?? new Date());
    const key = `${input.account_id}:${bucket}`;
    const existing = this.get(input.account_id, bucket);
    const inc = input.increment ?? 1;
    const next: UsageSnapshot = {
      ...existing,
      analyses_created: existing.analyses_created + (input.kind === "analysis" ? inc : 0),
      artifacts_uploaded: existing.artifacts_uploaded + (input.kind === "upload" ? inc : 0),
      report_exports: existing.report_exports + (input.kind === "export" ? inc : 0),
    };
    usageByAccountMonth.set(key, next);
    return next;
  },
};
