import type { PlanId } from "@/lib/contracts/account";
import type { EntitlementSnapshot } from "@/lib/contracts/entitlements";
import { PLAN_MATRIX } from "@/lib/server/entitlements/plans";

export function resolveEntitlementsForPlan(
  accountId: string,
  planId: PlanId,
  source: EntitlementSnapshot["source_of_truth"],
): EntitlementSnapshot {
  const template = PLAN_MATRIX[planId] ?? PLAN_MATRIX.explorer;
  return {
    account_id: accountId,
    ...template,
    effective_at: new Date().toISOString(),
    source_of_truth: source,
  };
}
