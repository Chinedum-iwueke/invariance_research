import type { Account, Subscription, User } from "@/lib/contracts/account";
import type { EntitlementSnapshot, UsageSnapshot } from "@/lib/contracts/entitlements";

export interface AccountState {
  user: User;
  account: Account;
  subscription?: Subscription;
  entitlements: EntitlementSnapshot;
}

export interface UsageInput {
  account_id: string;
  kind: "analysis" | "upload" | "export" | "program" | "hypothesis" | "experiment" | "experiment_compute" | "assistant" | "share" | "research_desk";
  increment?: number;
  at?: Date;
}

export interface UsageRepository {
  get(accountId: string, monthBucket: string): UsageSnapshot;
  increment(input: UsageInput): UsageSnapshot;
}
