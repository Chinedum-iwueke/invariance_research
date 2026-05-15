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
  {
    version: 5,
    name: "analysis_runtime_config_persistence",
    sql: `
      ALTER TABLE analyses ADD COLUMN runtime_config_json TEXT;
    `,
  },
  {
    version: 6,
    name: "publications_module",
    sql: `
      CREATE TABLE IF NOT EXISTS publications (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL,
        summary TEXT NOT NULL,
        status TEXT NOT NULL,
        published_at TEXT,
        updated_at TEXT NOT NULL,
        cover_image_url TEXT NOT NULL,
        pdf_url TEXT NOT NULL,
        viewer_url TEXT,
        featured INTEGER NOT NULL DEFAULT 0,
        author_label TEXT,
        estimated_read_time TEXT,
        tags_json TEXT,
        sort_order INTEGER,
        seo_title TEXT,
        seo_description TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_publications_category_status ON publications(category, status);
      CREATE INDEX IF NOT EXISTS idx_publications_published_at ON publications(published_at);
    `,
  },

  {
    version: 7,
    name: "research_desk_waitlist",
    sql: `
      CREATE TABLE IF NOT EXISTS waitlist_entries (
        waitlist_entry_id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        normalized_email TEXT NOT NULL,
        name TEXT,
        source_page TEXT NOT NULL,
        role_or_team TEXT,
        status TEXT NOT NULL DEFAULT 'new',
        note TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_entries_email_source
        ON waitlist_entries(normalized_email, source_page);
      CREATE INDEX IF NOT EXISTS idx_waitlist_entries_status_created_at
        ON waitlist_entries(status, created_at DESC);
    `,
  },
  {
    version: 8,
    name: "auth_password_credentials",
    sql: `
      ALTER TABLE users ADD COLUMN password_hash TEXT;
      ALTER TABLE users ADD COLUMN password_updated_at TEXT;
    `,
  },

  {
    version: 9,
    name: "research_videos_module",
    sql: `
      CREATE TABLE IF NOT EXISTS videos (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL,
        youtube_url TEXT NOT NULL,
        category TEXT NOT NULL,
        episode_number INTEGER NOT NULL,
        duration TEXT,
        thumbnail_override_url TEXT,
        status TEXT NOT NULL,
        published_at TEXT,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_videos_status_category ON videos(status, category);
      CREATE INDEX IF NOT EXISTS idx_videos_episode_published ON videos(episode_number, published_at DESC);
    `,
  },
  {
    version: 10,
    name: "analysis_job_queue_contract",
    sql: `
      ALTER TABLE analysis_jobs ADD COLUMN account_id TEXT;
      ALTER TABLE analysis_jobs ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE analysis_jobs ADD COLUMN max_attempts INTEGER NOT NULL DEFAULT 3;
      ALTER TABLE analysis_jobs ADD COLUMN leased_until TEXT;
      ALTER TABLE analysis_jobs ADD COLUMN last_error TEXT;
      ALTER TABLE analysis_jobs ADD COLUMN updated_at TEXT;

      CREATE INDEX IF NOT EXISTS idx_analysis_jobs_claimable
        ON analysis_jobs(status, available_at, leased_until, created_at);
      CREATE INDEX IF NOT EXISTS idx_analysis_jobs_dead_letter
        ON analysis_jobs(status, finished_at);
    `,
  },
  {
    version: 11,
    name: "publication_object_storage_keys",
    sql: `
      ALTER TABLE publications ADD COLUMN cover_storage_key TEXT;
      ALTER TABLE publications ADD COLUMN pdf_storage_key TEXT;
    `,
  },
  {
    version: 12,
    name: "auth_admin_hardening",
    sql: `
      ALTER TABLE users ADD COLUMN email_verified_at TEXT;
      ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0;

      CREATE TABLE IF NOT EXISTS auth_tokens (
        token_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(user_id),
        purpose TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        consumed_at TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_purpose
        ON auth_tokens(user_id, purpose, expires_at);

      CREATE TABLE IF NOT EXISTS user_roles (
        user_id TEXT NOT NULL REFERENCES users(user_id),
        role TEXT NOT NULL,
        created_at TEXT NOT NULL,
        created_by TEXT,
        PRIMARY KEY (user_id, role)
      );

      CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);

      CREATE TABLE IF NOT EXISTS admin_audit_log (
        id TEXT PRIMARY KEY,
        actor_user_id TEXT,
        actor_email TEXT,
        action TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        resource_id TEXT,
        metadata_json TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at
        ON admin_audit_log(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor
        ON admin_audit_log(actor_user_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS rate_limit_buckets (
        key TEXT NOT NULL,
        route TEXT NOT NULL,
        window_start TEXT NOT NULL,
        count INTEGER NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (key, route, window_start)
      );

      CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_route_window
        ON rate_limit_buckets(route, window_start);
    `,
  },
  {
    version: 13,
    name: "rate_limit_buckets",
    sql: `
      CREATE TABLE IF NOT EXISTS rate_limit_buckets (
        key TEXT NOT NULL,
        route TEXT NOT NULL,
        window_start TEXT NOT NULL,
        count INTEGER NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (key, route, window_start)
      );

      CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_route_window
        ON rate_limit_buckets(route, window_start);
    `,
  },
  {
    version: 14,
    name: "report_snapshot_foundation",
    sql: `
      CREATE TABLE IF NOT EXISTS report_snapshots (
        snapshot_id TEXT PRIMARY KEY,
        analysis_id TEXT NOT NULL REFERENCES analyses(analysis_id),
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        status TEXT NOT NULL,
        source_analysis_updated_at TEXT NOT NULL,
        source_result_checksum TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        warning_count INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        superseded_at TEXT
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_report_snapshots_analysis_checksum
        ON report_snapshots(analysis_id, source_result_checksum);
      CREATE INDEX IF NOT EXISTS idx_report_snapshots_analysis_status
        ON report_snapshots(analysis_id, status, created_at DESC);

      ALTER TABLE exports ADD COLUMN report_snapshot_id TEXT REFERENCES report_snapshots(snapshot_id);
      CREATE INDEX IF NOT EXISTS idx_exports_report_snapshot
        ON exports(report_snapshot_id);
    `,
  },
  {
    version: 15,
    name: "share_room_trust_boundary",
    sql: `
      CREATE TABLE IF NOT EXISTS share_tokens (
        share_id TEXT PRIMARY KEY,
        token_hash TEXT NOT NULL UNIQUE,
        report_snapshot_id TEXT NOT NULL REFERENCES report_snapshots(snapshot_id),
        analysis_id TEXT NOT NULL REFERENCES analyses(analysis_id),
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        created_by_user_id TEXT NOT NULL REFERENCES users(user_id),
        status TEXT NOT NULL,
        expires_at TEXT,
        revoked_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS share_access_events (
        event_id TEXT PRIMARY KEY,
        share_id TEXT,
        token_hash_prefix TEXT NOT NULL,
        report_snapshot_id TEXT,
        outcome TEXT NOT NULL,
        ip_hash TEXT,
        user_agent_hash TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_share_tokens_hash ON share_tokens(token_hash);
      CREATE INDEX IF NOT EXISTS idx_share_tokens_snapshot_status ON share_tokens(report_snapshot_id, status);
      CREATE INDEX IF NOT EXISTS idx_share_tokens_expiry ON share_tokens(expires_at, status);
      CREATE INDEX IF NOT EXISTS idx_share_tokens_revoked ON share_tokens(revoked_at);
      CREATE INDEX IF NOT EXISTS idx_share_access_events_share_created ON share_access_events(share_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_share_access_events_snapshot_created ON share_access_events(report_snapshot_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_share_access_events_created ON share_access_events(created_at);
    `,
  },

];
