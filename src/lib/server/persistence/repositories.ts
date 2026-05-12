import { accountRepository, entitlementRepository, subscriptionRepository, usageRepository, userRepository } from "@/lib/server/accounts/repositories";
import {
  postgresAccountRepository,
  postgresEntitlementRepository,
  postgresSubscriptionRepository,
  postgresUsageRepository,
  postgresUserRepository,
} from "@/lib/server/accounts/postgres-repositories";
import { analysisRepository } from "@/lib/server/repositories/analysis-repository";
import { artifactRepository } from "@/lib/server/repositories/artifact-repository";
import { jobRepository } from "@/lib/server/repositories/job-repository";
import { postgresAnalysisRepository } from "@/lib/server/repositories/postgres-analysis-repository";
import { postgresAnalysisJobRepository } from "@/lib/server/repositories/postgres-analysis-job-repository";
import { postgresArtifactRepository } from "@/lib/server/repositories/postgres-artifact-repository";
import { sqliteTransactionRunner } from "@/lib/server/persistence/database";
import { getDatabaseProvider } from "@/lib/server/persistence/provider";
import { withPostgresTransaction } from "@/lib/server/persistence/postgres";
import type { CoreRepositories } from "@/lib/server/persistence/contracts";

export function getCoreRepositories(): CoreRepositories {
  const provider = getDatabaseProvider();
  if (provider === "postgres") {
    return {
      provider,
      transactions: {
        withTransaction: (fn) => withPostgresTransaction(() => Promise.resolve(fn({ provider }))),
      },
      users: postgresUserRepository,
      accounts: postgresAccountRepository,
      subscriptions: postgresSubscriptionRepository,
      entitlements: postgresEntitlementRepository,
      usage: postgresUsageRepository,
      analyses: postgresAnalysisRepository,
      artifacts: postgresArtifactRepository,
      analysisJobs: postgresAnalysisJobRepository,
    };
  }

  return {
    provider,
    transactions: {
      withTransaction: (fn) => sqliteTransactionRunner.withTransaction(() => fn({ provider })),
    },
    users: userRepository,
    accounts: accountRepository,
    subscriptions: subscriptionRepository,
    entitlements: entitlementRepository,
    usage: usageRepository,
    analyses: analysisRepository,
    artifacts: artifactRepository,
    analysisJobs: jobRepository,
  };
}
