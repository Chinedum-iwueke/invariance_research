import { entitlementRepository, usageRepository } from "@/lib/server/accounts/repositories";
import { accountService } from "@/lib/server/accounts/service";
import { getDatabaseProvider } from "@/lib/server/persistence/provider";
import { getPostgresPool } from "@/lib/server/persistence/postgres";
import { getSqliteRuntimeDb } from "@/lib/server/persistence/sqlite-runtime";
import { getCoreRepositories } from "@/lib/server/persistence/repositories";

function monthBucket(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function iso(value: unknown) {
  return value instanceof Date ? value.toISOString() : String(value);
}

export type AdminAccountOverview = {
  account_id: string;
  owner_email: string;
  plan_id: string;
  subscription_status: string;
  usage_this_month: {
    analyses_created: number;
    artifacts_uploaded: number;
    report_exports: number;
    programs_created: number;
    hypotheses_created: number;
    experiments_queued: number;
    experiment_compute_units: number;
    assistant_calls: number;
    share_links_created: number;
    research_desk_requests: number;
  };
  entitlement_summary: string;
  created_at: string;
  current_period_end?: string;
  cancel_at_period_end?: boolean;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  has_password: boolean;
};

async function readAccountRows() {
  const sql = `SELECT a.*, u.email as owner_email, u.password_hash, s.provider_customer_id, s.provider_subscription_id, s.current_period_end, s.cancel_at_period_end
      FROM accounts a
      JOIN users u ON u.user_id = a.owner_user_id
      LEFT JOIN subscriptions s ON s.account_id = a.account_id
      ORDER BY a.created_at DESC`;

  if (getDatabaseProvider() === "postgres") {
    const result = await getPostgresPool().query<Record<string, unknown>>(sql);
    return result.rows;
  }

  return getSqliteRuntimeDb()
    .prepare(
      `SELECT a.*, u.email as owner_email, u.password_hash, s.provider_customer_id, s.provider_subscription_id, s.current_period_end, s.cancel_at_period_end
      FROM accounts a
      JOIN users u ON u.user_id = a.owner_user_id
      LEFT JOIN subscriptions s ON s.account_id = a.account_id
      ORDER BY a.created_at DESC`,
    )
    .all() as Record<string, unknown>[];
}

export async function listAdminAccounts(filter?: { plan?: string; status?: string; highUsage?: boolean }) {
  const rows = await readAccountRows();

  const bucket = monthBucket(new Date());
  const repositories = getDatabaseProvider() === "postgres" ? getCoreRepositories() : undefined;

  const accounts: AdminAccountOverview[] = await Promise.all(rows
    .map(async (row) => {
      const accountId = String(row.account_id);
      const usage = repositories ? await repositories.usage.get(accountId, bucket) : await usageRepository.get(accountId, bucket);
      const entitlements = repositories ? await repositories.entitlements.get(accountId) : await entitlementRepository.get(accountId);
      return {
        account_id: accountId,
        owner_email: String(row.owner_email),
        plan_id: String(row.plan_id),
        subscription_status: String(row.subscription_status),
        usage_this_month: {
          analyses_created: usage.analyses_created,
          artifacts_uploaded: usage.artifacts_uploaded,
          report_exports: usage.report_exports,
          programs_created: usage.programs_created,
          hypotheses_created: usage.hypotheses_created,
          experiments_queued: usage.experiments_queued,
          experiment_compute_units: usage.experiment_compute_units,
          assistant_calls: usage.assistant_calls,
          share_links_created: usage.share_links_created,
          research_desk_requests: usage.research_desk_requests,
        },
        entitlement_summary: [
          `${entitlements.programs_limit} programs`,
          `${entitlements.active_hypotheses_limit} hypotheses`,
          `${entitlements.queued_experiments_limit} queued experiments`,
          `${entitlements.concurrent_experiments_limit} concurrent`,
          `${entitlements.monthly_experiment_compute_units} compute units/mo`,
          `${entitlements.monthly_assistant_calls} assistant calls/mo`,
          `${entitlements.memory_retention_days}d memory`,
          entitlements.can_request_research_desk ? "Research Desk eligible" : "Research Desk locked",
        ].join(", "),
        created_at: iso(row.created_at),
        current_period_end: row.current_period_end ? iso(row.current_period_end) : undefined,
        cancel_at_period_end: Boolean(row.cancel_at_period_end),
        stripe_customer_id: row.provider_customer_id ? String(row.provider_customer_id) : undefined,
        stripe_subscription_id: row.provider_subscription_id ? String(row.provider_subscription_id) : undefined,
        has_password: Boolean(row.password_hash),
      };
    }))
  ;
  const filtered = accounts
    .filter((item) => (filter?.plan ? item.plan_id === filter.plan : true))
    .filter((item) => (filter?.status ? item.subscription_status === filter.status : true))
    .filter((item) => (filter?.highUsage ? item.usage_this_month.analyses_created >= 8 : true));

  return {
    rows: filtered,
    summaryByPlan: filtered.reduce<Record<string, number>>((acc, item) => {
      acc[item.plan_id] = (acc[item.plan_id] ?? 0) + 1;
      return acc;
    }, {}),
  };
}


export async function adminSetAccountPassword(input: { email: string; password: string }) {
  return accountService.setPasswordForEmail(input);
}
