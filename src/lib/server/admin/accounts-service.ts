import { entitlementRepository, usageRepository } from "@/lib/server/accounts/repositories";
import { getDb } from "@/lib/server/persistence/database";

function monthBucket(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type AdminAccountOverview = {
  account_id: string;
  owner_email: string;
  plan_id: string;
  subscription_status: string;
  usage_this_month: { analyses_created: number; artifacts_uploaded: number; report_exports: number };
  entitlement_summary: string;
  created_at: string;
  current_period_end?: string;
  cancel_at_period_end?: boolean;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
};

export function listAdminAccounts(filter?: { plan?: string; status?: string; highUsage?: boolean }) {
  const rows = getDb()
    .prepare(
      `SELECT a.*, u.email as owner_email, s.provider_customer_id, s.provider_subscription_id, s.current_period_end, s.cancel_at_period_end
      FROM accounts a
      JOIN users u ON u.user_id = a.owner_user_id
      LEFT JOIN subscriptions s ON s.account_id = a.account_id
      ORDER BY a.created_at DESC`,
    )
    .all() as Record<string, unknown>[];

  const bucket = monthBucket(new Date());

  const accounts: AdminAccountOverview[] = rows
    .map((row) => {
      const accountId = String(row.account_id);
      const usage = usageRepository.get(accountId, bucket);
      const entitlements = entitlementRepository.get(accountId);
      return {
        account_id: accountId,
        owner_email: String(row.owner_email),
        plan_id: String(row.plan_id),
        subscription_status: String(row.subscription_status),
        usage_this_month: {
          analyses_created: usage.analyses_created,
          artifacts_uploaded: usage.artifacts_uploaded,
          report_exports: usage.report_exports,
        },
        entitlement_summary: `${entitlements.analyses_per_month}/mo analyses, exports ${entitlements.can_export_report ? "enabled" : "disabled"}`,
        created_at: String(row.created_at),
        current_period_end: row.current_period_end ? String(row.current_period_end) : undefined,
        cancel_at_period_end: Boolean(row.cancel_at_period_end),
        stripe_customer_id: row.provider_customer_id ? String(row.provider_customer_id) : undefined,
        stripe_subscription_id: row.provider_subscription_id ? String(row.provider_subscription_id) : undefined,
      };
    })
    .filter((item) => (filter?.plan ? item.plan_id === filter.plan : true))
    .filter((item) => (filter?.status ? item.subscription_status === filter.status : true))
    .filter((item) => (filter?.highUsage ? item.usage_this_month.analyses_created >= 8 : true));

  return {
    rows: accounts,
    summaryByPlan: accounts.reduce<Record<string, number>>((acc, item) => {
      acc[item.plan_id] = (acc[item.plan_id] ?? 0) + 1;
      return acc;
    }, {}),
  };
}
