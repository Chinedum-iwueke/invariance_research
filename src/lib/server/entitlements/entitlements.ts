import type { PlanId } from "@/lib/contracts/account";
import type { EntitlementSnapshot } from "@/lib/contracts/entitlements";
import { PLAN_MATRIX, canonicalPlanId } from "@/lib/server/entitlements/plans";

export function resolveEntitlementsForPlan(
  accountId: string,
  planId: PlanId,
  source: EntitlementSnapshot["source_of_truth"],
): EntitlementSnapshot {
  const canonical = canonicalPlanId(planId);
  const template = PLAN_MATRIX[canonical] ?? PLAN_MATRIX.free;
  return {
    account_id: accountId,
    ...template,
    effective_at: new Date().toISOString(),
    source_of_truth: source,
  };
}
