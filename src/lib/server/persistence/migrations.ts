export const migrations = [
  {
    version: 1,
    name: "core_durable_persistence",
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT,
        created_at TEXT NOT NULL,
        last_login_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS accounts (
        account_id TEXT PRIMARY KEY,
        owner_user_id TEXT NOT NULL UNIQUE REFERENCES users(user_id),
        plan_id TEXT NOT NULL,
        subscription_status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS subscriptions (
        subscription_id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL UNIQUE REFERENCES accounts(account_id),
        provider TEXT NOT NULL,
        provider_customer_id TEXT NOT NULL,
        provider_subscription_id TEXT NOT NULL,
        plan_id TEXT NOT NULL,
        status TEXT NOT NULL,
        current_period_start TEXT,
        current_period_end TEXT,
        cancel_at_period_end INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS entitlement_snapshots (
        account_id TEXT PRIMARY KEY REFERENCES accounts(account_id),
        snapshot_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS usage_snapshots (
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        month_bucket TEXT NOT NULL,
        analyses_created INTEGER NOT NULL,
        artifacts_uploaded INTEGER NOT NULL,
        report_exports INTEGER NOT NULL,
        PRIMARY KEY (account_id, month_bucket)
      );

      CREATE TABLE IF NOT EXISTS artifacts (
        artifact_id TEXT PRIMARY KEY,
        owner_user_id TEXT NOT NULL REFERENCES users(user_id),
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        analysis_id TEXT,
        file_name TEXT NOT NULL,
        file_type TEXT NOT NULL,
        file_size_bytes INTEGER NOT NULL,
        storage_key TEXT NOT NULL,
        artifact_kind TEXT NOT NULL,
        richness TEXT NOT NULL,
        uploaded_at TEXT NOT NULL,
        parsed_artifact_json TEXT NOT NULL,
        eligibility_summary_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS analyses (
        analysis_id TEXT PRIMARY KEY,
        owner_user_id TEXT NOT NULL REFERENCES users(user_id),
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        status TEXT NOT NULL,
        strategy_name TEXT,
        artifact_id TEXT NOT NULL REFERENCES artifacts(artifact_id),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        result_json TEXT,
        eligibility_snapshot_json TEXT,
        engine_context_json TEXT,
        failure_code TEXT,
        failure_message TEXT
      );

      CREATE TABLE IF NOT EXISTS analysis_jobs (
        job_id TEXT PRIMARY KEY,
        analysis_id TEXT NOT NULL UNIQUE REFERENCES analyses(analysis_id),
        job_type TEXT NOT NULL,
        status TEXT NOT NULL,
        progress_pct INTEGER,
        current_step TEXT,
        error_code TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT,
        retry_count INTEGER NOT NULL,
        available_at TEXT,
        last_attempt_at TEXT
      );

      CREATE TABLE IF NOT EXISTS webhook_events (
        webhook_event_id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        provider_event_id TEXT NOT NULL UNIQUE,
        event_type TEXT NOT NULL,
        received_at TEXT NOT NULL,
        processed_at TEXT,
        status TEXT NOT NULL,
        attempt_count INTEGER NOT NULL,
        error_summary TEXT,
        payload_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status_available_at ON analysis_jobs(status, available_at);
    `,
  },
  {
    version: 2,
    name: "exports_and_storage_hardening",
    sql: `
      ALTER TABLE artifacts ADD COLUMN checksum_sha256 TEXT;

      CREATE TABLE IF NOT EXISTS export_jobs (
        export_job_id TEXT PRIMARY KEY,
        export_id TEXT NOT NULL UNIQUE,
        analysis_id TEXT NOT NULL REFERENCES analyses(analysis_id),
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        status TEXT NOT NULL,
        format TEXT NOT NULL,
        progress_pct INTEGER,
        current_step TEXT,
        error_code TEXT,
        error_message TEXT,
        retry_count INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT,
        available_at TEXT,
        last_attempt_at TEXT
      );

      CREATE TABLE IF NOT EXISTS exports (
        export_id TEXT PRIMARY KEY,
        analysis_id TEXT NOT NULL REFERENCES analyses(analysis_id),
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        requested_by_user_id TEXT NOT NULL REFERENCES users(user_id),
        format TEXT NOT NULL,
        status TEXT NOT NULL,
        storage_key TEXT,
        content_type TEXT,
        file_size_bytes INTEGER,
        checksum_sha256 TEXT,
        error_code TEXT,
        error_message TEXT,
        requested_at TEXT NOT NULL,
        expires_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_export_jobs_status_available_at ON export_jobs(status, available_at);
      CREATE INDEX IF NOT EXISTS idx_exports_account_analysis ON exports(account_id, analysis_id);
    `,
  },
  {
    version: 3,
    name: "worker_heartbeats",
    sql: `
      CREATE TABLE IF NOT EXISTS worker_heartbeats (
        worker_type TEXT NOT NULL,
        instance_id TEXT NOT NULL,
        status TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        last_job_id TEXT,
        last_job_status TEXT,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (worker_type, instance_id)
      );

      CREATE INDEX IF NOT EXISTS idx_worker_heartbeats_type_last_seen ON worker_heartbeats(worker_type, last_seen_at);
    `,
  },
  {
    version: 4,
    name: "analysis_benchmark_persistence",
    sql: `
      ALTER TABLE analyses ADD COLUMN benchmark_json TEXT;
    `,
  },
];
