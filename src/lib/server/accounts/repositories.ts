import { randomUUID } from "node:crypto";
import type { Account, PlanId, Subscription, User } from "@/lib/contracts/account";
import type { EntitlementSnapshot, UsageSnapshot } from "@/lib/contracts/entitlements";
import type { UsageInput } from "@/lib/server/accounts/models";
import { resolveEntitlementsForPlan } from "@/lib/server/entitlements/entitlements";
import { getDb } from "@/lib/server/persistence/database";
import type { AccountRepository, EntitlementRepository, SubscriptionRepository, UsageSnapshotRepository, UserRepository } from "@/lib/server/persistence/contracts";

function monthBucket(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function toBool(value: unknown) {
  return Boolean(Number(value));
}

function usageSnapshot(row: Partial<UsageSnapshot> | undefined, accountId: string, bucket: string): UsageSnapshot {
  return {
    account_id: row?.account_id ?? accountId,
    month_bucket: row?.month_bucket ?? bucket,
    analyses_created: Number(row?.analyses_created ?? 0),
    artifacts_uploaded: Number(row?.artifacts_uploaded ?? 0),
    report_exports: Number(row?.report_exports ?? 0),
    programs_created: Number(row?.programs_created ?? 0),
    hypotheses_created: Number(row?.hypotheses_created ?? 0),
    experiments_queued: Number(row?.experiments_queued ?? 0),
    experiment_compute_units: Number(row?.experiment_compute_units ?? 0),
    assistant_calls: Number(row?.assistant_calls ?? 0),
    share_links_created: Number(row?.share_links_created ?? 0),
    research_desk_requests: Number(row?.research_desk_requests ?? 0),
  };
}

export const userRepository: UserRepository = {
  mode: "read-write",
  findById(userId: string) {
    return getDb().prepare("SELECT * FROM users WHERE user_id = ?").get(userId) as User | undefined;
  },
  findByEmail(email: string) {
    const row = getDb().prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase()) as User | undefined;
    return row;
  },
  save(input: { email: string; name?: string; password_hash?: string; email_verified_at?: string }) {
    const now = new Date().toISOString();
    const user: User = {
      user_id: randomUUID(),
      email: input.email.toLowerCase(),
      name: input.name,
      created_at: now,
      last_login_at: now,
      password_hash: input.password_hash,
      password_updated_at: input.password_hash ? now : undefined,
      email_verified_at: input.email_verified_at,
      session_version: 0,
    };
    getDb()
      .prepare(
        "INSERT INTO users (user_id, email, name, created_at, last_login_at, password_hash, password_updated_at, email_verified_at, session_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(user.user_id, user.email, user.name ?? null, user.created_at, now, user.password_hash ?? null, user.password_updated_at ?? null, user.email_verified_at ?? null, user.session_version);
    return user;
  },
  touchLogin(userId: string) {
    getDb().prepare("UPDATE users SET last_login_at = ? WHERE user_id = ?").run(new Date().toISOString(), userId);
  },
  updatePassword(userId: string, passwordHash: string) {
    const now = new Date().toISOString();
    getDb().prepare("UPDATE users SET password_hash = ?, password_updated_at = ? WHERE user_id = ?").run(passwordHash, now, userId);
  },
  markEmailVerified(userId: string, verifiedAt = new Date().toISOString()) {
    getDb().prepare("UPDATE users SET email_verified_at = ? WHERE user_id = ?").run(verifiedAt, userId);
  },
  incrementSessionVersion(userId: string) {
    getDb().prepare("UPDATE users SET session_version = COALESCE(session_version, 0) + 1 WHERE user_id = ?").run(userId);
  },
};

export const accountRepository: AccountRepository = {
  mode: "read-write",
  findByOwnerUserId(ownerUserId: string) {
    return getDb().prepare("SELECT * FROM accounts WHERE owner_user_id = ?").get(ownerUserId) as Account | undefined;
  },
  findById(accountId: string) {
    return getDb().prepare("SELECT * FROM accounts WHERE account_id = ?").get(accountId) as Account | undefined;
  },
  save(ownerUserId: string, planId: PlanId = "free") {
    const now = new Date().toISOString();
    const account: Account = {
      account_id: randomUUID(),
      owner_user_id: ownerUserId,
      plan_id: planId,
      subscription_status: "active",
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

export const subscriptionRepository: SubscriptionRepository = {
  mode: "read-write",
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
    const row = getDb().prepare("SELECT * FROM subscriptions WHERE account_id = ?").get(accountId) as (Omit<Subscription, "cancel_at_period_end"> & { cancel_at_period_end: number }) | undefined;
    return row ? { ...row, cancel_at_period_end: toBool(row.cancel_at_period_end) } : undefined;
  },
};

export const entitlementRepository: EntitlementRepository = {
  mode: "read-write",
  get(accountId: string) {
    const row = getDb().prepare("SELECT snapshot_json FROM entitlement_snapshots WHERE account_id = ?").get(accountId) as { snapshot_json: string } | undefined;
    return row ? (JSON.parse(row.snapshot_json) as EntitlementSnapshot) : resolveEntitlementsForPlan(accountId, "free", "plan_matrix");
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

export const usageRepository: UsageSnapshotRepository = {
  mode: "read-write",
  get(accountId, bucket) {
    const row = getDb().prepare("SELECT * FROM usage_snapshots WHERE account_id = ? AND month_bucket = ?").get(accountId, bucket) as UsageSnapshot | undefined;
    return usageSnapshot(row, accountId, bucket);
  },
  increment(input: UsageInput) {
    const bucket = monthBucket(input.at ?? new Date());
    const existing = this.get(input.account_id, bucket) as UsageSnapshot;
    const inc = input.increment ?? 1;
    const next: UsageSnapshot = {
      ...existing,
      analyses_created: existing.analyses_created + (input.kind === "analysis" ? inc : 0),
      artifacts_uploaded: existing.artifacts_uploaded + (input.kind === "upload" ? inc : 0),
      report_exports: existing.report_exports + (input.kind === "export" ? inc : 0),
      programs_created: existing.programs_created + (input.kind === "program" ? inc : 0),
      hypotheses_created: existing.hypotheses_created + (input.kind === "hypothesis" ? inc : 0),
      experiments_queued: existing.experiments_queued + (input.kind === "experiment" ? inc : 0),
      experiment_compute_units: existing.experiment_compute_units + (input.kind === "experiment_compute" ? inc : 0),
      assistant_calls: existing.assistant_calls + (input.kind === "assistant" ? inc : 0),
      share_links_created: existing.share_links_created + (input.kind === "share" ? inc : 0),
      research_desk_requests: existing.research_desk_requests + (input.kind === "research_desk" ? inc : 0),
    };
    getDb()
      .prepare(
        `INSERT INTO usage_snapshots (account_id, month_bucket, analyses_created, artifacts_uploaded, report_exports, programs_created, hypotheses_created, experiments_queued, experiment_compute_units, assistant_calls, share_links_created, research_desk_requests) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(account_id, month_bucket) DO UPDATE SET
          analyses_created=excluded.analyses_created,
          artifacts_uploaded=excluded.artifacts_uploaded,
          report_exports=excluded.report_exports,
          programs_created=excluded.programs_created,
          hypotheses_created=excluded.hypotheses_created,
          experiments_queued=excluded.experiments_queued,
          experiment_compute_units=excluded.experiment_compute_units,
          assistant_calls=excluded.assistant_calls,
          share_links_created=excluded.share_links_created,
          research_desk_requests=excluded.research_desk_requests`,
      )
      .run(
        next.account_id,
        next.month_bucket,
        next.analyses_created,
        next.artifacts_uploaded,
        next.report_exports,
        next.programs_created,
        next.hypotheses_created,
        next.experiments_queued,
        next.experiment_compute_units,
        next.assistant_calls,
        next.share_links_created,
        next.research_desk_requests,
      );
    return next;
  },
};
