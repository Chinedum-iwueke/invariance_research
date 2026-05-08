import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { getPostgresPool } from "../src/lib/server/persistence/postgres";
import { postgresSchemaSql } from "../src/lib/server/persistence/postgres-schema";

type TablePlan = {
  name: string;
  columns: string[];
  jsonColumns?: string[];
  booleanColumns?: string[];
};

const tables: TablePlan[] = [
  { name: "users", columns: ["user_id", "email", "name", "created_at", "last_login_at", "password_hash", "password_updated_at"] },
  { name: "accounts", columns: ["account_id", "owner_user_id", "plan_id", "subscription_status", "created_at", "updated_at"] },
  {
    name: "subscriptions",
    columns: ["subscription_id", "account_id", "provider", "provider_customer_id", "provider_subscription_id", "plan_id", "status", "current_period_start", "current_period_end", "cancel_at_period_end"],
    booleanColumns: ["cancel_at_period_end"],
  },
  { name: "entitlement_snapshots", columns: ["account_id", "snapshot_json", "updated_at"], jsonColumns: ["snapshot_json"] },
  { name: "usage_snapshots", columns: ["account_id", "month_bucket", "analyses_created", "artifacts_uploaded", "report_exports"] },
  {
    name: "artifacts",
    columns: ["artifact_id", "owner_user_id", "account_id", "analysis_id", "file_name", "file_type", "file_size_bytes", "storage_key", "checksum_sha256", "artifact_kind", "richness", "uploaded_at", "parsed_artifact_json", "eligibility_summary_json"],
    jsonColumns: ["parsed_artifact_json", "eligibility_summary_json"],
  },
  {
    name: "analyses",
    columns: ["analysis_id", "owner_user_id", "account_id", "status", "strategy_name", "artifact_id", "created_at", "updated_at", "result_json", "eligibility_snapshot_json", "engine_context_json", "benchmark_json", "runtime_config_json", "failure_code", "failure_message"],
    jsonColumns: ["result_json", "eligibility_snapshot_json", "engine_context_json", "benchmark_json", "runtime_config_json"],
  },
  {
    name: "analysis_jobs",
    columns: ["job_id", "analysis_id", "account_id", "job_type", "status", "progress_pct", "current_step", "error_code", "error_message", "created_at", "updated_at", "started_at", "finished_at", "retry_count", "attempts", "max_attempts", "available_at", "last_attempt_at", "leased_until", "last_error"],
  },
  { name: "webhook_events", columns: ["webhook_event_id", "provider", "provider_event_id", "event_type", "received_at", "processed_at", "status", "attempt_count", "error_summary", "payload_json"], jsonColumns: ["payload_json"] },
  {
    name: "publications",
    columns: ["id", "title", "slug", "category", "summary", "status", "published_at", "updated_at", "cover_image_url", "pdf_url", "cover_storage_key", "pdf_storage_key", "viewer_url", "featured", "author_label", "estimated_read_time", "tags_json", "sort_order", "seo_title", "seo_description"],
    jsonColumns: ["tags_json"],
    booleanColumns: ["featured"],
  },
  { name: "waitlist_entries", columns: ["waitlist_entry_id", "email", "normalized_email", "name", "source_page", "role_or_team", "status", "note", "created_at", "updated_at"] },
];

function readArg(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function tableExists(db: DatabaseSync, table: string) {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(table) as { name?: string } | undefined;
  return Boolean(row?.name);
}

function existingColumns(db: DatabaseSync, table: string) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return new Set(rows.map((row) => row.name));
}

function normalizeValue(plan: TablePlan, column: string, value: unknown) {
  if (value === undefined) return null;
  if (plan.booleanColumns?.includes(column)) return Boolean(Number(value));
  if (plan.jsonColumns?.includes(column) && typeof value === "string") return JSON.parse(value);
  return value;
}

async function main() {
  const sqlitePath = readArg("sqlite") ?? process.env.INVARIANCE_DB_PATH ?? path.join(process.cwd(), ".data", "invariance.sqlite");
  const dryRun = hasFlag("dry-run");
  const sqlite = new DatabaseSync(sqlitePath, { readOnly: true });
  const counts: Record<string, number> = {};

  if (!dryRun) {
    await getPostgresPool().query(postgresSchemaSql);
  }

  for (const plan of tables) {
    if (!tableExists(sqlite, plan.name)) {
      counts[plan.name] = 0;
      continue;
    }
    const available = existingColumns(sqlite, plan.name);
    const columns = plan.columns.filter((column) => available.has(column));
    const rows = sqlite.prepare(`SELECT ${columns.join(", ")} FROM ${plan.name}`).all() as Record<string, unknown>[];
    counts[plan.name] = rows.length;

    if (dryRun || rows.length === 0) continue;

    const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
    const assignments = columns.map((column) => `${column}=EXCLUDED.${column}`).join(", ");
    const primary = columns[0];
    const sql = `INSERT INTO ${plan.name} (${columns.join(", ")}) VALUES (${placeholders}) ON CONFLICT (${primary}) DO UPDATE SET ${assignments}`;

    for (const row of rows) {
      await getPostgresPool().query(sql, columns.map((column) => normalizeValue(plan, column, row[column])));
    }
  }

  sqlite.close();
  console.table(counts);
  if (dryRun) {
    console.log("Dry run only. No Postgres writes were performed.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
