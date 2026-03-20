import { accountService } from "@/lib/server/accounts/service";
import { accountRepository, userRepository } from "@/lib/server/accounts/repositories";
import { isAdminIdentity } from "@/lib/server/admin/guards";

export function assertUsageWithinPlan(accountId: string) {
  const state = accountService.getAccountState(accountId);
  if (!state) throw new Error("account_not_found");

  const owner = accountRepository.findById(accountId);
  const accountOwnerUser = owner ? userRepository.findById(owner.owner_user_id) : undefined;
  if (accountOwnerUser && isAdminIdentity({ user_id: accountOwnerUser.user_id, email: accountOwnerUser.email })) {
    return accountService.getUsage(accountId);
  }

  const usage = accountService.getUsage(accountId);
  if (usage.analyses_created >= state.entitlements.analyses_per_month) {
    throw new Error("monthly_analysis_limit_reached");
  }
  return usage;
}
