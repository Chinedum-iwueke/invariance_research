import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { getPostgresPool } from "../src/lib/server/persistence/postgres";
import { postgresSchemaSql } from "../src/lib/server/persistence/postgres-schema";

type TablePlan = {
  name: string;
  columns: string[];
  conflictColumns?: string[];
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
  { name: "usage_snapshots", columns: ["account_id", "month_bucket", "analyses_created", "artifacts_uploaded", "report_exports"], conflictColumns: ["account_id", "month_bucket"] },
  {
    name: "artifacts",
    columns: ["artifact_id", "owner_user_id", "account_id", "analysis_id", "file_name", "file_type", "file_size_bytes", "storage_key", "checksum_sha256", "artifact_kind", "richness", "uploaded_at", "parsed_artifact_json", "eligibility_summary_json"],
    jsonColumns: ["parsed_artifact_json", "eligibility_summary_json"],
  },
  {
    name: "analyses",
    columns: ["analysis_id", "owner_user_id", "account_id", "status", "strategy_name", "program_id", "artifact_id", "created_at", "updated_at", "result_json", "eligibility_snapshot_json", "engine_context_json", "benchmark_json", "runtime_config_json", "failure_code", "failure_message"],
    jsonColumns: ["result_json", "eligibility_snapshot_json", "engine_context_json", "benchmark_json", "runtime_config_json"],
  },
  {
    name: "analysis_jobs",
    columns: ["job_id", "analysis_id", "account_id", "job_type", "status", "progress_pct", "current_step", "error_code", "error_message", "created_at", "updated_at", "started_at", "finished_at", "retry_count", "attempts", "max_attempts", "available_at", "last_attempt_at", "leased_until", "last_error"],
  },
  {
    name: "export_jobs",
    columns: ["export_job_id", "export_id", "analysis_id", "account_id", "status", "format", "progress_pct", "current_step", "error_code", "error_message", "retry_count", "created_at", "started_at", "finished_at", "available_at", "last_attempt_at"],
  },
  {
    name: "exports",
    columns: ["export_id", "analysis_id", "program_id", "account_id", "requested_by_user_id", "format", "status", "storage_key", "content_type", "file_size_bytes", "checksum_sha256", "error_code", "error_message", "requested_at", "expires_at", "created_at", "updated_at"],
  },
  {
    name: "report_snapshots",
    columns: ["snapshot_id", "analysis_id", "program_id", "account_id", "status", "source_analysis_updated_at", "source_result_checksum", "payload_json", "warning_count", "created_at", "superseded_at"],
    jsonColumns: ["payload_json"],
  },
  {
    name: "research_programs",
    columns: ["program_id", "account_id", "owner_user_id", "title", "thesis", "status", "market", "asset_universe", "timeframe", "next_action", "created_at", "updated_at", "archived_at"],
  },
  {
    name: "program_members",
    columns: ["program_id", "account_id", "user_id", "role", "created_at"],
    conflictColumns: ["program_id", "user_id"],
  },
  {
    name: "program_events",
    columns: ["event_id", "program_id", "account_id", "actor_user_id", "event_type", "title", "summary", "payload_json", "created_at"],
    jsonColumns: ["payload_json"],
  },
  {
    name: "program_artifacts",
    columns: ["program_artifact_id", "program_id", "account_id", "artifact_id", "analysis_id", "artifact_role", "attached_by_user_id", "created_at"],
  },
  {
    name: "program_notes",
    columns: ["note_id", "program_id", "account_id", "author_user_id", "note_type", "body", "created_at", "updated_at"],
  },
  {
    name: "program_report_snapshots",
    columns: ["program_report_snapshot_id", "program_id", "account_id", "report_snapshot_id", "title", "status", "payload_json", "created_at"],
    jsonColumns: ["payload_json"],
  },
  {
    name: "program_clarification_sessions",
    columns: ["session_id", "program_id", "account_id", "created_by_user_id", "status", "raw_intuition", "intake_fields_json", "assistant_questions_json", "missing_assumptions_json", "accepted_answers_json", "research_brief_json", "provider", "model", "error_summary", "created_at", "updated_at", "accepted_at"],
    jsonColumns: ["intake_fields_json", "assistant_questions_json", "missing_assumptions_json", "accepted_answers_json", "research_brief_json"],
  },
  {
    name: "research_briefs",
    columns: ["brief_id", "program_id", "account_id", "clarification_session_id", "version", "status", "brief_json", "created_by_user_id", "created_at", "accepted_at"],
    jsonColumns: ["brief_json"],
  },
  {
    name: "hypotheses",
    columns: ["hypothesis_id", "program_id", "account_id", "title", "status", "active_version_id", "created_by_user_id", "created_at", "updated_at"],
  },
  {
    name: "hypothesis_versions",
    columns: ["hypothesis_version_id", "hypothesis_id", "program_id", "account_id", "version", "status", "source_brief_id", "spec_json", "validation_errors_json", "created_by_user_id", "created_at", "approved_at", "approved_by_user_id"],
    jsonColumns: ["spec_json", "validation_errors_json"],
  },
  {
    name: "hypothesis_approvals",
    columns: ["approval_id", "hypothesis_version_id", "hypothesis_id", "program_id", "account_id", "actor_user_id", "from_status", "to_status", "note", "created_at"],
  },
  {
    name: "strategy_specs",
    columns: ["strategy_spec_record_id", "program_id", "account_id", "hypothesis_version_id", "version", "status", "spec_json", "validation_errors_json", "created_by_user_id", "created_at", "approved_at", "approved_by_user_id"],
    jsonColumns: ["spec_json", "validation_errors_json"],
  },
  {
    name: "experiment_plans",
    columns: ["experiment_plan_id", "program_id", "account_id", "strategy_spec_record_id", "hypothesis_version_id", "status", "plan_json", "validation_errors_json", "created_by_user_id", "created_at", "approved_at", "approved_by_user_id", "queued_at"],
    jsonColumns: ["plan_json", "validation_errors_json"],
  },
  {
    name: "experiment_plan_items",
    columns: ["experiment_plan_item_id", "experiment_plan_id", "program_id", "account_id", "item_key", "experiment_type", "title", "status", "priority", "required_datasets_json", "runtime_budget_json", "config_patch_json", "falsification_question", "created_at", "queued_at"],
    jsonColumns: ["required_datasets_json", "runtime_budget_json", "config_patch_json"],
  },
  {
    name: "experiment_jobs",
    columns: ["experiment_job_id", "experiment_plan_item_id", "experiment_plan_id", "program_id", "account_id", "status", "priority", "progress_pct", "current_step", "retry_count", "max_attempts", "available_at", "leased_until", "last_error", "created_at", "updated_at", "started_at", "finished_at"],
  },
  {
    name: "experiment_job_events",
    columns: ["experiment_job_event_id", "experiment_job_id", "experiment_plan_id", "program_id", "account_id", "event_type", "message", "payload_json", "actor_user_id", "created_at"],
    jsonColumns: ["payload_json"],
  },
  { name: "webhook_events", columns: ["webhook_event_id", "provider", "provider_event_id", "event_type", "received_at", "processed_at", "status", "attempt_count", "error_summary", "payload_json"], jsonColumns: ["payload_json"] },
  {
    name: "publications",
    columns: ["id", "title", "slug", "category", "summary", "status", "published_at", "updated_at", "cover_image_url", "pdf_url", "cover_storage_key", "pdf_storage_key", "viewer_url", "featured", "author_label", "estimated_read_time", "tags_json", "sort_order", "seo_title", "seo_description"],
    jsonColumns: ["tags_json"],
    booleanColumns: ["featured"],
  },
  {
    name: "videos",
    columns: ["id", "title", "slug", "description", "youtube_url", "category", "episode_number", "duration", "thumbnail_override_url", "status", "published_at", "updated_at"],
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
    const conflictColumns = plan.conflictColumns ?? [columns[0]];
    const sql = `INSERT INTO ${plan.name} (${columns.join(", ")}) VALUES (${placeholders}) ON CONFLICT (${conflictColumns.join(", ")}) DO UPDATE SET ${assignments}`;

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
