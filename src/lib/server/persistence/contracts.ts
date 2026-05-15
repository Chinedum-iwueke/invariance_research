import type { Account, Subscription, User } from "@/lib/contracts/account";
import type { EntitlementSnapshot, UsageSnapshot } from "@/lib/contracts/entitlements";
import type { AnalysisEntity, AnalysisJob, UploadArtifact } from "@/lib/server/analysis/models";
import type { UsageInput, UsageRepository } from "@/lib/server/accounts/models";

export type RepositoryMode = "read-write" | "query-only";

export interface TransactionContext {
  provider: "sqlite" | "postgres";
}

export interface TransactionRunner {
  withTransaction<T>(fn: (tx: TransactionContext) => T | Promise<T>): T | Promise<T>;
}

export interface UserRepository {
  readonly mode: RepositoryMode;
  findById(userId: string): User | undefined;
  findByEmail(email: string): User | undefined;
  save(input: { email: string; name?: string; password_hash?: string; email_verified_at?: string }): User;
  touchLogin(userId: string): void;
  updatePassword(userId: string, passwordHash: string): void;
  markEmailVerified(userId: string, verifiedAt?: string): void;
  incrementSessionVersion(userId: string): void;
}

export interface AccountRepository {
  readonly mode: RepositoryMode;
  findByOwnerUserId(ownerUserId: string): Account | undefined;
  findById(accountId: string): Account | undefined;
  save(ownerUserId: string, planId?: Account["plan_id"]): Account;
  updatePlan(accountId: string, planId: Account["plan_id"], status: Account["subscription_status"]): Account | undefined;
}

export interface SubscriptionRepository {
  readonly mode: RepositoryMode;
  upsert(subscription: Subscription): Subscription;
  findByAccountId(accountId: string): Subscription | undefined;
}

export interface EntitlementRepository {
  readonly mode: RepositoryMode;
  get(accountId: string): EntitlementSnapshot;
  set(snapshot: EntitlementSnapshot): EntitlementSnapshot;
}

export type UsageSnapshotRepository = UsageRepository & { readonly mode: RepositoryMode };

export interface AnalysisRepository {
  readonly mode: RepositoryMode;
  save(analysis: AnalysisEntity): AnalysisEntity;
  update(analysisId: string, updater: (current: AnalysisEntity) => AnalysisEntity): AnalysisEntity | undefined;
  findById(analysisId: string): AnalysisEntity | undefined;
  list(): AnalysisEntity[];
  countCompletedForMonth(accountId: string, monthBucket: string): number;
  completedCountsByMonth(accountId: string): Array<{ month_bucket: string; completed_count: number }>;
}

export interface ArtifactRepository {
  readonly mode: RepositoryMode;
  save(artifact: UploadArtifact): UploadArtifact;
  findById(artifactId: string): UploadArtifact | undefined;
  attachAnalysis(artifactId: string, analysisId: string): void;
}

export type AnalysisJobSaveInput = AnalysisJob & { available_at?: string; last_attempt_at?: string };

export interface AnalysisJobRepository {
  readonly mode: RepositoryMode;
  save(job: AnalysisJobSaveInput): AnalysisJob;
  findByAnalysisId(analysisId: string): AnalysisJob | undefined;
  findById(jobId: string): AnalysisJob | undefined;
  updateByAnalysisId(analysisId: string, updater: (current: AnalysisJob) => AnalysisJob): AnalysisJob | undefined;
  claimNextQueued(nowIso: string, options?: { leaseMs?: number; workerId?: string }): AnalysisJob | undefined;
  listFailed(limit?: number): AnalysisJob[];
  listDeadLetters(limit?: number): AnalysisJob[];
}

export interface AsyncAnalysisJobRepository {
  readonly mode: RepositoryMode;
  save(job: AnalysisJobSaveInput): Promise<AnalysisJob>;
  findByAnalysisId(analysisId: string): Promise<AnalysisJob | undefined>;
  findById(jobId: string): Promise<AnalysisJob | undefined>;
  updateByAnalysisId(analysisId: string, updater: (current: AnalysisJob) => AnalysisJob): Promise<AnalysisJob | undefined>;
  claimNextQueued(nowIso: string, options?: { leaseMs?: number; workerId?: string }): Promise<AnalysisJob | undefined>;
  listFailed(limit?: number): Promise<AnalysisJob[]>;
  listDeadLetters(limit?: number): Promise<AnalysisJob[]>;
}

export interface CoreRepositories {
  readonly provider: "sqlite" | "postgres";
  readonly transactions: TransactionRunner;
  readonly users: UserRepository;
  readonly accounts: AccountRepository;
  readonly subscriptions: SubscriptionRepository;
  readonly entitlements: EntitlementRepository;
  readonly usage: UsageSnapshotRepository;
  readonly analyses: AnalysisRepository;
  readonly artifacts: ArtifactRepository;
  readonly analysisJobs: AnalysisJobRepository | AsyncAnalysisJobRepository;
}

export type WaitlistRepositoryContract = {
  readonly mode: RepositoryMode;
};

export type PublicationRepositoryContract = {
  readonly mode: RepositoryMode;
};

export type BillingRepositoryContract = {
  readonly mode: RepositoryMode;
  get(accountId: string, bucket: string): UsageSnapshot;
  increment(input: UsageInput): UsageSnapshot;
};
