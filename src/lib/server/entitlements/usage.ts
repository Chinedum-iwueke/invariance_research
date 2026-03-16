import { accountService } from "@/lib/server/accounts/service";

export function assertUsageWithinPlan(accountId: string) {
  const state = accountService.getAccountState(accountId);
  if (!state) throw new Error("account_not_found");

  const usage = accountService.getUsage(accountId);
  if (usage.analyses_created >= state.entitlements.analyses_per_month) {
    throw new Error("monthly_analysis_limit_reached");
  }
  return usage;
}
