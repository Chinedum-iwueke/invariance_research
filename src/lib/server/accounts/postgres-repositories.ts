import { randomUUID } from "node:crypto";
import type { Account, PlanId, Subscription, User } from "@/lib/contracts/account";
import type { EntitlementSnapshot, UsageSnapshot } from "@/lib/contracts/entitlements";
import type { UsageInput } from "@/lib/server/accounts/models";
import { resolveEntitlementsForPlan } from "@/lib/server/entitlements/entitlements";
import { getPostgresPool } from "@/lib/server/persistence/postgres";
import type { AccountRepository, EntitlementRepository, SubscriptionRepository, UsageSnapshotRepository, UserRepository } from "@/lib/server/persistence/contracts";

function monthBucket(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function iso(value: unknown) {
  return value instanceof Date ? value.toISOString() : String(value);
}

function optionalIso(value: unknown) {
  return value ? iso(value) : undefined;
}

function mapUser(row: Record<string, unknown>): User {
  return {
    user_id: String(row.user_id),
    email: String(row.email),
    name: row.name ? String(row.name) : undefined,
    created_at: iso(row.created_at),
    last_login_at: iso(row.last_login_at),
    password_hash: row.password_hash ? String(row.password_hash) : undefined,
    password_updated_at: optionalIso(row.password_updated_at),
    email_verified_at: optionalIso(row.email_verified_at),
    session_version: Number(row.session_version ?? 0),
  };
}

function mapAccount(row: Record<string, unknown>): Account {
  return {
    account_id: String(row.account_id),
    owner_user_id: String(row.owner_user_id),
    plan_id: row.plan_id as Account["plan_id"],
    subscription_status: row.subscription_status as Account["subscription_status"],
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
  };
}

function mapSubscription(row: Record<string, unknown>): Subscription {
  return {
    subscription_id: String(row.subscription_id),
    account_id: String(row.account_id),
    provider: row.provider as Subscription["provider"],
    provider_customer_id: String(row.provider_customer_id),
    provider_subscription_id: String(row.provider_subscription_id),
    plan_id: row.plan_id as Subscription["plan_id"],
    status: row.status as Subscription["status"],
    current_period_start: optionalIso(row.current_period_start),
    current_period_end: optionalIso(row.current_period_end),
    cancel_at_period_end: Boolean(row.cancel_at_period_end),
  };
}

export const postgresUserRepository = {
  mode: "read-write",
  async findById(userId: string) {
    const result = await getPostgresPool().query("SELECT * FROM users WHERE user_id = $1", [userId]);
    return result.rows[0] ? mapUser(result.rows[0]) : undefined;
  },
  async findByEmail(email: string) {
    const result = await getPostgresPool().query("SELECT * FROM users WHERE email = $1", [email.toLowerCase()]);
    return result.rows[0] ? mapUser(result.rows[0]) : undefined;
  },
  async save(input: { email: string; name?: string; password_hash?: string; email_verified_at?: string }) {
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
    await getPostgresPool().query(
      "INSERT INTO users (user_id, email, name, created_at, last_login_at, password_hash, password_updated_at, email_verified_at, session_version) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [user.user_id, user.email, user.name ?? null, user.created_at, user.last_login_at, user.password_hash ?? null, user.password_updated_at ?? null, user.email_verified_at ?? null, user.session_version],
    );
    return user;
  },
  async touchLogin(userId: string) {
    await getPostgresPool().query("UPDATE users SET last_login_at = $1 WHERE user_id = $2", [new Date().toISOString(), userId]);
  },
  async updatePassword(userId: string, passwordHash: string) {
    const now = new Date().toISOString();
    await getPostgresPool().query("UPDATE users SET password_hash = $1, password_updated_at = $2 WHERE user_id = $3", [passwordHash, now, userId]);
  },
  async markEmailVerified(userId: string, verifiedAt = new Date().toISOString()) {
    await getPostgresPool().query("UPDATE users SET email_verified_at = $1 WHERE user_id = $2", [verifiedAt, userId]);
  },
  async incrementSessionVersion(userId: string) {
    await getPostgresPool().query("UPDATE users SET session_version = COALESCE(session_version, 0) + 1 WHERE user_id = $1", [userId]);
  },
} as unknown as UserRepository;

export const postgresAccountRepository = {
  mode: "read-write",
  async findByOwnerUserId(ownerUserId: string) {
    const result = await getPostgresPool().query("SELECT * FROM accounts WHERE owner_user_id = $1", [ownerUserId]);
    return result.rows[0] ? mapAccount(result.rows[0]) : undefined;
  },
  async findById(accountId: string) {
    const result = await getPostgresPool().query("SELECT * FROM accounts WHERE account_id = $1", [accountId]);
    return result.rows[0] ? mapAccount(result.rows[0]) : undefined;
  },
  async save(ownerUserId: string, planId: PlanId = "free") {
    const now = new Date().toISOString();
    const account: Account = {
      account_id: randomUUID(),
      owner_user_id: ownerUserId,
      plan_id: planId,
      subscription_status: "active",
      created_at: now,
      updated_at: now,
    };
    await getPostgresPool().query(
      "INSERT INTO accounts (account_id, owner_user_id, plan_id, subscription_status, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6)",
      [account.account_id, account.owner_user_id, account.plan_id, account.subscription_status, account.created_at, account.updated_at],
    );
    await postgresEntitlementRepository.set(resolveEntitlementsForPlan(account.account_id, planId, "plan_matrix"));
    return account;
  },
  async updatePlan(accountId: string, planId: PlanId, status: Account["subscription_status"]) {
    const now = new Date().toISOString();
    await getPostgresPool().query("UPDATE accounts SET plan_id = $1, subscription_status = $2, updated_at = $3 WHERE account_id = $4", [
      planId,
      status,
      now,
      accountId,
    ]);
    await postgresEntitlementRepository.set(resolveEntitlementsForPlan(accountId, planId, "stripe_webhook"));
    return postgresAccountRepository.findById(accountId);
  },
} as unknown as AccountRepository;

export const postgresSubscriptionRepository = {
  mode: "read-write",
  async upsert(subscription: Subscription) {
    await getPostgresPool().query(
      `INSERT INTO subscriptions (subscription_id, account_id, provider, provider_customer_id, provider_subscription_id, plan_id, status, current_period_start, current_period_end, cancel_at_period_end)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT(account_id) DO UPDATE SET
         subscription_id=EXCLUDED.subscription_id,
         provider=EXCLUDED.provider,
         provider_customer_id=EXCLUDED.provider_customer_id,
         provider_subscription_id=EXCLUDED.provider_subscription_id,
         plan_id=EXCLUDED.plan_id,
         status=EXCLUDED.status,
         current_period_start=EXCLUDED.current_period_start,
         current_period_end=EXCLUDED.current_period_end,
         cancel_at_period_end=EXCLUDED.cancel_at_period_end`,
      [
        subscription.subscription_id,
        subscription.account_id,
        subscription.provider,
        subscription.provider_customer_id,
        subscription.provider_subscription_id,
        subscription.plan_id,
        subscription.status,
        subscription.current_period_start ?? null,
        subscription.current_period_end ?? null,
        subscription.cancel_at_period_end,
      ],
    );
    return subscription;
  },
  async findByAccountId(accountId: string) {
    const result = await getPostgresPool().query("SELECT * FROM subscriptions WHERE account_id = $1", [accountId]);
    return result.rows[0] ? mapSubscription(result.rows[0]) : undefined;
  },
} as unknown as SubscriptionRepository;

export const postgresEntitlementRepository = {
  mode: "read-write",
  async get(accountId: string) {
    const result = await getPostgresPool().query("SELECT snapshot_json FROM entitlement_snapshots WHERE account_id = $1", [accountId]);
    const snapshot = result.rows[0]?.snapshot_json;
    return snapshot ? (typeof snapshot === "string" ? JSON.parse(snapshot) : snapshot) : resolveEntitlementsForPlan(accountId, "free", "plan_matrix");
  },
  async set(snapshot: EntitlementSnapshot) {
    await getPostgresPool().query(
      `INSERT INTO entitlement_snapshots (account_id, snapshot_json, updated_at) VALUES ($1,$2,$3)
       ON CONFLICT(account_id) DO UPDATE SET snapshot_json=EXCLUDED.snapshot_json, updated_at=EXCLUDED.updated_at`,
      [snapshot.account_id, JSON.stringify(snapshot), new Date().toISOString()],
    );
    return snapshot;
  },
} as unknown as EntitlementRepository;

export const postgresUsageRepository = {
  mode: "read-write",
  async get(accountId: string, bucket: string) {
    const result = await getPostgresPool().query("SELECT * FROM usage_snapshots WHERE account_id = $1 AND month_bucket = $2", [accountId, bucket]);
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return (
      row
        ? {
            account_id: String(row.account_id),
            month_bucket: String(row.month_bucket),
            analyses_created: Number(row.analyses_created ?? 0),
            artifacts_uploaded: Number(row.artifacts_uploaded ?? 0),
            report_exports: Number(row.report_exports ?? 0),
          }
        : {
        account_id: accountId,
        month_bucket: bucket,
        analyses_created: 0,
        artifacts_uploaded: 0,
        report_exports: 0,
      }
    );
  },
  async increment(input: UsageInput) {
    const bucket = monthBucket(input.at ?? new Date());
    const existing = await postgresUsageRepository.get(input.account_id, bucket);
    const inc = input.increment ?? 1;
    const next: UsageSnapshot = {
      ...existing,
      analyses_created: existing.analyses_created + (input.kind === "analysis" ? inc : 0),
      artifacts_uploaded: existing.artifacts_uploaded + (input.kind === "upload" ? inc : 0),
      report_exports: existing.report_exports + (input.kind === "export" ? inc : 0),
    };
    await getPostgresPool().query(
      `INSERT INTO usage_snapshots (account_id, month_bucket, analyses_created, artifacts_uploaded, report_exports) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT(account_id, month_bucket) DO UPDATE SET
         analyses_created=EXCLUDED.analyses_created,
         artifacts_uploaded=EXCLUDED.artifacts_uploaded,
         report_exports=EXCLUDED.report_exports`,
      [next.account_id, next.month_bucket, next.analyses_created, next.artifacts_uploaded, next.report_exports],
    );
    return next;
  },
} as unknown as UsageSnapshotRepository;
