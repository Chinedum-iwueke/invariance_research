import { randomUUID } from "node:crypto";
import type { Account, PlanId, Subscription, User } from "@/lib/contracts/account";
import type { EntitlementSnapshot, UsageSnapshot } from "@/lib/contracts/entitlements";
import type { UsageInput, UsageRepository } from "@/lib/server/accounts/models";
import { resolveEntitlementsForPlan } from "@/lib/server/entitlements/entitlements";
import { getDb } from "@/lib/server/persistence/database";

function monthBucket(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function toBool(value: unknown) {
  return Boolean(Number(value));
}

export const userRepository = {
  findByEmail(email: string) {
    const row = getDb().prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase()) as User | undefined;
    return row;
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
    getDb().prepare("INSERT INTO users (user_id, email, name, created_at, last_login_at) VALUES (?, ?, ?, ?, ?)").run(
      user.user_id,
      user.email,
      user.name ?? null,
      user.created_at,
      user.last_login_at,
    );
    return user;
  },
  touchLogin(userId: string) {
    getDb().prepare("UPDATE users SET last_login_at = ? WHERE user_id = ?").run(new Date().toISOString(), userId);
  },
};

export const accountRepository = {
  findByOwnerUserId(ownerUserId: string) {
    return getDb().prepare("SELECT * FROM accounts WHERE owner_user_id = ?").get(ownerUserId) as Account | undefined;
  },
  findById(accountId: string) {
    return getDb().prepare("SELECT * FROM accounts WHERE account_id = ?").get(accountId) as Account | undefined;
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
    getDb()
      .prepare(
        "INSERT INTO accounts (account_id, owner_user_id, plan_id, subscription_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(account.account_id, account.owner_user_id, account.plan_id, account.subscription_status, account.created_at, account.updated_at);
    entitlementRepository.set(resolveEntitlementsForPlan(account.account_id, planId, "plan_matrix"));
    return account;
  },
  updatePlan(accountId: string, planId: PlanId, status: Account["subscription_status"]) {
    const now = new Date().toISOString();
    getDb().prepare("UPDATE accounts SET plan_id = ?, subscription_status = ?, updated_at = ? WHERE account_id = ?").run(planId, status, now, accountId);
    entitlementRepository.set(resolveEntitlementsForPlan(accountId, planId, "stripe_webhook"));
    return this.findById(accountId);
  },
};

export const subscriptionRepository = {
  upsert(subscription: Subscription) {
    getDb()
      .prepare(
        `INSERT INTO subscriptions (subscription_id, account_id, provider, provider_customer_id, provider_subscription_id, plan_id, status, current_period_start, current_period_end, cancel_at_period_end)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(account_id) DO UPDATE SET
           subscription_id=excluded.subscription_id,
           provider=excluded.provider,
           provider_customer_id=excluded.provider_customer_id,
           provider_subscription_id=excluded.provider_subscription_id,
           plan_id=excluded.plan_id,
           status=excluded.status,
           current_period_start=excluded.current_period_start,
           current_period_end=excluded.current_period_end,
           cancel_at_period_end=excluded.cancel_at_period_end`,
      )
      .run(
        subscription.subscription_id,
        subscription.account_id,
        subscription.provider,
        subscription.provider_customer_id,
        subscription.provider_subscription_id,
        subscription.plan_id,
        subscription.status,
        subscription.current_period_start ?? null,
        subscription.current_period_end ?? null,
        subscription.cancel_at_period_end ? 1 : 0,
      );
    return subscription;
  },
  findByAccountId(accountId: string) {
    const row = getDb().prepare("SELECT * FROM subscriptions WHERE account_id = ?").get(accountId) as (Subscription & { cancel_at_period_end: number }) | undefined;
    return row ? { ...row, cancel_at_period_end: toBool(row.cancel_at_period_end) } : undefined;
  },
};

export const entitlementRepository = {
  get(accountId: string) {
    const row = getDb().prepare("SELECT snapshot_json FROM entitlement_snapshots WHERE account_id = ?").get(accountId) as { snapshot_json: string } | undefined;
    return row ? (JSON.parse(row.snapshot_json) as EntitlementSnapshot) : resolveEntitlementsForPlan(accountId, "explorer", "plan_matrix");
  },
  set(snapshot: EntitlementSnapshot) {
    getDb()
      .prepare(
        `INSERT INTO entitlement_snapshots (account_id, snapshot_json, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(account_id) DO UPDATE SET snapshot_json=excluded.snapshot_json, updated_at=excluded.updated_at`,
      )
      .run(snapshot.account_id, JSON.stringify(snapshot), new Date().toISOString());
    return snapshot;
  },
};

export const usageRepository: UsageRepository = {
  get(accountId, bucket) {
    const row = getDb().prepare("SELECT * FROM usage_snapshots WHERE account_id = ? AND month_bucket = ?").get(accountId, bucket) as UsageSnapshot | undefined;
    return (
      row ?? {
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
    const existing = this.get(input.account_id, bucket);
    const inc = input.increment ?? 1;
    const next: UsageSnapshot = {
      ...existing,
      analyses_created: existing.analyses_created + (input.kind === "analysis" ? inc : 0),
      artifacts_uploaded: existing.artifacts_uploaded + (input.kind === "upload" ? inc : 0),
      report_exports: existing.report_exports + (input.kind === "export" ? inc : 0),
    };
    getDb()
      .prepare(
        `INSERT INTO usage_snapshots (account_id, month_bucket, analyses_created, artifacts_uploaded, report_exports) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(account_id, month_bucket) DO UPDATE SET
          analyses_created=excluded.analyses_created,
          artifacts_uploaded=excluded.artifacts_uploaded,
          report_exports=excluded.report_exports`,
      )
      .run(next.account_id, next.month_bucket, next.analyses_created, next.artifacts_uploaded, next.report_exports);
    return next;
  },
};
