import { accountService } from "@/lib/server/accounts/service";
import { isAdminIdentity } from "@/lib/server/admin/guards";
import { getCoreRepositories } from "@/lib/server/persistence/repositories";

export async function assertUsageWithinPlan(accountId: string) {
  const state = await accountService.getAccountState(accountId);
  if (!state) throw new Error("account_not_found");

  const repositories = getCoreRepositories();
  const owner = await repositories.accounts.findById(accountId);
  const accountOwnerUser = owner ? await repositories.users.findById(owner.owner_user_id) : undefined;
  if (accountOwnerUser && isAdminIdentity({ user_id: accountOwnerUser.user_id, email: accountOwnerUser.email })) {
    return accountService.getUsage(accountId);
  }

  const usage = await accountService.getUsage(accountId);
  if (usage.analyses_created >= state.entitlements.analyses_per_month) {
    throw new Error("monthly_analysis_limit_reached");
  }
  return usage;
}
