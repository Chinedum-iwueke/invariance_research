import { getDb, closeDbForTests } from "@/lib/server/persistence/database";

interface CliOptions {
  accountIds: string[];
  emails: string[];
  dryRun: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { accountIds: [], emails: [], dryRun: false };

  for (let idx = 0; idx < argv.length; idx += 1) {
    const arg = argv[idx];
    if (arg === "--account-id") {
      const value = argv[idx + 1];
      if (value) options.accountIds.push(value);
      idx += 1;
      continue;
    }
    if (arg === "--email") {
      const value = argv[idx + 1];
      if (value) options.emails.push(value.toLowerCase());
      idx += 1;
      continue;
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
    }
  }

  return options;
}

function resolveTargetAccounts(options: CliOptions): string[] {
  const db = getDb();
  const ids = new Set<string>(options.accountIds);

  if (options.emails.length > 0) {
    const placeholders = options.emails.map(() => "?").join(",");
    const rows = db
      .prepare(
        `SELECT a.account_id
         FROM accounts a
         JOIN users u ON u.user_id = a.owner_user_id
         WHERE lower(u.email) IN (${placeholders})`,
      )
      .all(...options.emails) as Array<{ account_id: string }>;
    rows.forEach((row) => ids.add(row.account_id));
  }

  if (ids.size > 0) return [...ids];

  const allRows = db.prepare("SELECT account_id FROM accounts").all() as Array<{ account_id: string }>;
  return allRows.map((row) => row.account_id);
}

function recalculateUsage(accountId: string, dryRun: boolean) {
  const db = getDb();
  const completed = db
    .prepare(
      `SELECT substr(updated_at, 1, 7) as month_bucket, COUNT(*) as completed_count
       FROM analyses
       WHERE account_id = ?
         AND status = 'completed'
       GROUP BY substr(updated_at, 1, 7)`,
    )
    .all(accountId) as Array<{ month_bucket: string; completed_count: number }>;

  const existing = db
    .prepare("SELECT month_bucket, analyses_created, artifacts_uploaded, report_exports FROM usage_snapshots WHERE account_id = ?")
    .all(accountId) as Array<{ month_bucket: string; analyses_created: number; artifacts_uploaded: number; report_exports: number }>;

  const byMonth = new Map<string, number>(completed.map((row) => [String(row.month_bucket), Number(row.completed_count)]));

  if (!dryRun) {
    db.prepare("DELETE FROM usage_snapshots WHERE account_id = ?").run(accountId);
    existing.forEach((row) => {
      const correctedAnalyses = byMonth.get(row.month_bucket) ?? 0;
      db.prepare(
        `INSERT INTO usage_snapshots (account_id, month_bucket, analyses_created, artifacts_uploaded, report_exports)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(accountId, row.month_bucket, correctedAnalyses, row.artifacts_uploaded, row.report_exports);
      byMonth.delete(row.month_bucket);
    });

    for (const [monthBucket, analysesCreated] of byMonth.entries()) {
      db.prepare(
        `INSERT INTO usage_snapshots (account_id, month_bucket, analyses_created, artifacts_uploaded, report_exports)
         VALUES (?, ?, ?, 0, 0)`,
      ).run(accountId, monthBucket, analysesCreated);
    }
  }

  return {
    accountId,
    existingMonths: existing.length,
    correctedMonths: new Set([...existing.map((row) => row.month_bucket), ...completed.map((row) => row.month_bucket)]).size,
    correctedThisMonth: byMonth,
    completedByMonth: completed,
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const accountIds = resolveTargetAccounts(options);

  if (accountIds.length === 0) {
    console.log("No matching accounts found.");
    return;
  }

  for (const accountId of accountIds) {
    const db = getDb();
    const before = db
      .prepare("SELECT month_bucket, analyses_created FROM usage_snapshots WHERE account_id = ? ORDER BY month_bucket")
      .all(accountId) as Array<{ month_bucket: string; analyses_created: number }>;

    const completed = db
      .prepare(
        `SELECT substr(updated_at, 1, 7) as month_bucket, COUNT(*) as analyses_created
         FROM analyses
         WHERE account_id = ?
           AND status = 'completed'
         GROUP BY substr(updated_at, 1, 7)
         ORDER BY month_bucket`,
      )
      .all(accountId) as Array<{ month_bucket: string; analyses_created: number }>;

    recalculateUsage(accountId, options.dryRun);

    const after = options.dryRun
      ? completed
      : (db
          .prepare("SELECT month_bucket, analyses_created FROM usage_snapshots WHERE account_id = ? ORDER BY month_bucket")
          .all(accountId) as Array<{ month_bucket: string; analyses_created: number }>);

    console.log(JSON.stringify({ account_id: accountId, dry_run: options.dryRun, before, completed_only: completed, after }, null, 2));
  }
}

try {
  main();
} finally {
  closeDbForTests();
}
