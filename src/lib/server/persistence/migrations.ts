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
  {
    version: 16,
    name: "research_desk_learning_loop",
    sql: `
      CREATE TABLE IF NOT EXISTS research_desk_requests (
        request_id TEXT PRIMARY KEY,
        report_snapshot_id TEXT NOT NULL REFERENCES report_snapshots(snapshot_id),
        analysis_id TEXT NOT NULL REFERENCES analyses(analysis_id),
        artifact_id TEXT NOT NULL REFERENCES artifacts(artifact_id),
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        requested_by_user_id TEXT NOT NULL REFERENCES users(user_id),
        trigger_limitation TEXT NOT NULL,
        requested_services_json TEXT NOT NULL,
        validation_packet_json TEXT NOT NULL,
        status TEXT NOT NULL,
        user_note TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS report_reviewer_addenda (
        addendum_id TEXT PRIMARY KEY,
        request_id TEXT NOT NULL UNIQUE REFERENCES research_desk_requests(request_id),
        report_snapshot_id TEXT NOT NULL REFERENCES report_snapshots(snapshot_id),
        analysis_id TEXT NOT NULL REFERENCES analyses(analysis_id),
        reviewer_user_id TEXT NOT NULL REFERENCES users(user_id),
        status TEXT NOT NULL,
        internal_note TEXT,
        public_addendum TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        approved_at TEXT
      );

      CREATE TABLE IF NOT EXISTS wedge_learning_events (
        event_id TEXT PRIMARY KEY,
        request_id TEXT NOT NULL REFERENCES research_desk_requests(request_id),
        report_snapshot_id TEXT NOT NULL REFERENCES report_snapshots(snapshot_id),
        analysis_id TEXT NOT NULL REFERENCES analyses(analysis_id),
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        event_type TEXT NOT NULL,
        learning_key TEXT NOT NULL,
        evidence_count INTEGER NOT NULL,
        promotion_candidate INTEGER NOT NULL,
        promoted_at TEXT,
        metadata_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_research_desk_requests_status_created
        ON research_desk_requests(status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_research_desk_requests_analysis
        ON research_desk_requests(analysis_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_research_desk_requests_snapshot
        ON research_desk_requests(report_snapshot_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_reviewer_addenda_snapshot
        ON report_reviewer_addenda(report_snapshot_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_wedge_learning_events_key
        ON wedge_learning_events(learning_key, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_wedge_learning_events_promotion
        ON wedge_learning_events(promotion_candidate, created_at DESC);
    `,
  },
  {
    version: 17,
    name: "validation_command_layer",
    sql: `
      CREATE TABLE IF NOT EXISTS evidence_events (
        event_id TEXT PRIMARY KEY,
        analysis_id TEXT NOT NULL REFERENCES analyses(analysis_id),
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        artifact_id TEXT,
        report_snapshot_id TEXT,
        share_id TEXT,
        export_id TEXT,
        event_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_by_user_id TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_evidence_events_analysis_created
        ON evidence_events(analysis_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_evidence_events_account_created
        ON evidence_events(account_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_evidence_events_type_created
        ON evidence_events(event_type, created_at DESC);
    `,
  },
  {
    version: 18,
    name: "prop_evaluation_readiness",
    sql: `
      CREATE TABLE IF NOT EXISTS prop_evaluation_rule_profiles (
        profile_id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        owner_user_id TEXT NOT NULL REFERENCES users(user_id),
        label TEXT NOT NULL,
        firm_label TEXT,
        rules_json TEXT NOT NULL,
        rules_hash TEXT NOT NULL,
        visibility TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS prop_evaluation_rule_snapshots (
        rule_snapshot_id TEXT PRIMARY KEY,
        analysis_id TEXT NOT NULL REFERENCES analyses(analysis_id),
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        profile_id TEXT,
        source TEXT NOT NULL,
        label TEXT NOT NULL,
        rules_json TEXT NOT NULL,
        rules_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS prop_evaluation_results (
        result_id TEXT PRIMARY KEY,
        analysis_id TEXT NOT NULL REFERENCES analyses(analysis_id),
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        rule_snapshot_id TEXT NOT NULL REFERENCES prop_evaluation_rule_snapshots(rule_snapshot_id),
        status TEXT NOT NULL,
        verdict TEXT NOT NULL,
        first_breach_json TEXT,
        rule_status_json TEXT NOT NULL,
        target_progress_json TEXT NOT NULL,
        summary_metrics_json TEXT NOT NULL,
        limitation_codes_json TEXT NOT NULL,
        engine_payload_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_prop_rule_profiles_account
        ON prop_evaluation_rule_profiles(account_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_prop_rule_snapshots_analysis
        ON prop_evaluation_rule_snapshots(analysis_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_prop_results_analysis
        ON prop_evaluation_results(analysis_id, created_at DESC);
    `,
  },
  {
    version: 19,
    name: "research_program_foundation",
    sql: `
      CREATE TABLE IF NOT EXISTS research_programs (
        program_id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        owner_user_id TEXT NOT NULL REFERENCES users(user_id),
        title TEXT NOT NULL,
        thesis TEXT NOT NULL,
        status TEXT NOT NULL,
        market TEXT,
        asset_universe TEXT,
        timeframe TEXT,
        next_action TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        archived_at TEXT
      );

      CREATE TABLE IF NOT EXISTS program_members (
        program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        user_id TEXT NOT NULL REFERENCES users(user_id),
        role TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (program_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS program_events (
        event_id TEXT PRIMARY KEY,
        program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        actor_user_id TEXT,
        event_type TEXT NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS program_artifacts (
        program_artifact_id TEXT PRIMARY KEY,
        program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        artifact_id TEXT REFERENCES artifacts(artifact_id),
        analysis_id TEXT REFERENCES analyses(analysis_id),
        artifact_role TEXT NOT NULL,
        attached_by_user_id TEXT NOT NULL REFERENCES users(user_id),
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS program_notes (
        note_id TEXT PRIMARY KEY,
        program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        author_user_id TEXT NOT NULL REFERENCES users(user_id),
        note_type TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS program_report_snapshots (
        program_report_snapshot_id TEXT PRIMARY KEY,
        program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        report_snapshot_id TEXT REFERENCES report_snapshots(snapshot_id),
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      ALTER TABLE analyses ADD COLUMN program_id TEXT REFERENCES research_programs(program_id);
      ALTER TABLE report_snapshots ADD COLUMN program_id TEXT REFERENCES research_programs(program_id);
      ALTER TABLE exports ADD COLUMN program_id TEXT REFERENCES research_programs(program_id);

      CREATE INDEX IF NOT EXISTS idx_research_programs_account_updated
        ON research_programs(account_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_program_members_user
        ON program_members(user_id, program_id);
      CREATE INDEX IF NOT EXISTS idx_program_events_program_created
        ON program_events(program_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_program_artifacts_program
        ON program_artifacts(program_id, created_at DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_program_artifacts_unique_analysis
        ON program_artifacts(program_id, analysis_id)
        WHERE analysis_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_analyses_program
        ON analyses(program_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_program_report_snapshots_program
        ON program_report_snapshots(program_id, created_at DESC);
    `,
  },
  {
    version: 20,
    name: "research_brief_clarification",
    sql: `
      CREATE TABLE IF NOT EXISTS program_clarification_sessions (
        session_id TEXT PRIMARY KEY,
        program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        created_by_user_id TEXT NOT NULL REFERENCES users(user_id),
        status TEXT NOT NULL,
        raw_intuition TEXT NOT NULL,
        intake_fields_json TEXT NOT NULL,
        assistant_questions_json TEXT NOT NULL,
        missing_assumptions_json TEXT NOT NULL,
        accepted_answers_json TEXT,
        research_brief_json TEXT,
        provider TEXT NOT NULL,
        model TEXT,
        error_summary TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        accepted_at TEXT
      );

      CREATE TABLE IF NOT EXISTS research_briefs (
        brief_id TEXT PRIMARY KEY,
        program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        clarification_session_id TEXT REFERENCES program_clarification_sessions(session_id),
        version INTEGER NOT NULL,
        status TEXT NOT NULL,
        brief_json TEXT NOT NULL,
        created_by_user_id TEXT NOT NULL REFERENCES users(user_id),
        created_at TEXT NOT NULL,
        accepted_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_clarification_sessions_program_created
        ON program_clarification_sessions(program_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_research_briefs_program_version
        ON research_briefs(program_id, version DESC);
    `,
  },
  {
    version: 21,
    name: "hypothesis_spec_approval",
    sql: `
      CREATE TABLE IF NOT EXISTS hypotheses (
        hypothesis_id TEXT PRIMARY KEY,
        program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        active_version_id TEXT,
        created_by_user_id TEXT NOT NULL REFERENCES users(user_id),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS hypothesis_versions (
        hypothesis_version_id TEXT PRIMARY KEY,
        hypothesis_id TEXT NOT NULL REFERENCES hypotheses(hypothesis_id),
        program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        version INTEGER NOT NULL,
        status TEXT NOT NULL,
        source_brief_id TEXT REFERENCES research_briefs(brief_id),
        spec_json TEXT NOT NULL,
        validation_errors_json TEXT NOT NULL,
        created_by_user_id TEXT NOT NULL REFERENCES users(user_id),
        created_at TEXT NOT NULL,
        approved_at TEXT,
        approved_by_user_id TEXT
      );

      CREATE TABLE IF NOT EXISTS hypothesis_approvals (
        approval_id TEXT PRIMARY KEY,
        hypothesis_version_id TEXT NOT NULL REFERENCES hypothesis_versions(hypothesis_version_id),
        hypothesis_id TEXT NOT NULL REFERENCES hypotheses(hypothesis_id),
        program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        actor_user_id TEXT NOT NULL REFERENCES users(user_id),
        from_status TEXT,
        to_status TEXT NOT NULL,
        note TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_hypotheses_program_updated
        ON hypotheses(program_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_hypothesis_versions_program_created
        ON hypothesis_versions(program_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_hypothesis_approvals_version
        ON hypothesis_approvals(hypothesis_version_id, created_at DESC);
    `,
  },
  {
    version: 22,
    name: "strategy_spec_approval",
    sql: `
      CREATE TABLE IF NOT EXISTS strategy_specs (
        strategy_spec_record_id TEXT PRIMARY KEY,
        program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        hypothesis_version_id TEXT NOT NULL REFERENCES hypothesis_versions(hypothesis_version_id),
        version INTEGER NOT NULL,
        status TEXT NOT NULL,
        spec_json TEXT NOT NULL,
        validation_errors_json TEXT NOT NULL,
        created_by_user_id TEXT NOT NULL REFERENCES users(user_id),
        created_at TEXT NOT NULL,
        approved_at TEXT,
        approved_by_user_id TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_strategy_specs_program_created
        ON strategy_specs(program_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_strategy_specs_hypothesis_version
        ON strategy_specs(hypothesis_version_id, created_at DESC);
    `,
  },
  {
    version: 23,
    name: "research_experiment_planner_queue",
    sql: `
      CREATE TABLE IF NOT EXISTS experiment_plans (
        experiment_plan_id TEXT PRIMARY KEY,
        program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        strategy_spec_record_id TEXT NOT NULL REFERENCES strategy_specs(strategy_spec_record_id),
        hypothesis_version_id TEXT NOT NULL REFERENCES hypothesis_versions(hypothesis_version_id),
        status TEXT NOT NULL,
        plan_json TEXT NOT NULL,
        validation_errors_json TEXT NOT NULL,
        created_by_user_id TEXT NOT NULL REFERENCES users(user_id),
        created_at TEXT NOT NULL,
        approved_at TEXT,
        approved_by_user_id TEXT,
        queued_at TEXT
      );

      CREATE TABLE IF NOT EXISTS experiment_plan_items (
        experiment_plan_item_id TEXT PRIMARY KEY,
        experiment_plan_id TEXT NOT NULL REFERENCES experiment_plans(experiment_plan_id),
        program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        item_key TEXT NOT NULL,
        experiment_type TEXT NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        priority INTEGER NOT NULL,
        required_datasets_json TEXT NOT NULL,
        runtime_budget_json TEXT NOT NULL,
        config_patch_json TEXT NOT NULL,
        falsification_question TEXT NOT NULL,
        created_at TEXT NOT NULL,
        queued_at TEXT
      );

      CREATE TABLE IF NOT EXISTS experiment_jobs (
        experiment_job_id TEXT PRIMARY KEY,
        experiment_plan_item_id TEXT NOT NULL REFERENCES experiment_plan_items(experiment_plan_item_id),
        experiment_plan_id TEXT NOT NULL REFERENCES experiment_plans(experiment_plan_id),
        program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        status TEXT NOT NULL,
        priority INTEGER NOT NULL,
        progress_pct INTEGER NOT NULL,
        current_step TEXT NOT NULL,
        retry_count INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 3,
        available_at TEXT NOT NULL,
        leased_until TEXT,
        last_error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT
      );

      CREATE TABLE IF NOT EXISTS experiment_job_events (
        experiment_job_event_id TEXT PRIMARY KEY,
        experiment_job_id TEXT NOT NULL REFERENCES experiment_jobs(experiment_job_id),
        experiment_plan_id TEXT NOT NULL REFERENCES experiment_plans(experiment_plan_id),
        program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        event_type TEXT NOT NULL,
        message TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        actor_user_id TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_experiment_plans_program_created
        ON experiment_plans(program_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_experiment_plan_items_plan
        ON experiment_plan_items(experiment_plan_id, priority DESC);
      CREATE INDEX IF NOT EXISTS idx_experiment_jobs_claimable
        ON experiment_jobs(status, priority DESC, available_at, created_at);
      CREATE INDEX IF NOT EXISTS idx_experiment_jobs_account_status
        ON experiment_jobs(account_id, status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_experiment_job_events_job
        ON experiment_job_events(experiment_job_id, created_at DESC);
    `,
  },
  {
    version: 24,
    name: "tenant_scoped_research_memory",
    sql: `
      CREATE TABLE IF NOT EXISTS research_memory_items (
        memory_item_id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        experiment_job_id TEXT REFERENCES experiment_jobs(experiment_job_id),
        memory_type TEXT NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        status TEXT NOT NULL,
        confidence REAL NOT NULL DEFAULT 0,
        source_event_id TEXT,
        source_card_type TEXT,
        source_json TEXT NOT NULL,
        tags_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS research_memory_links (
        memory_link_id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        source_memory_item_id TEXT NOT NULL REFERENCES research_memory_items(memory_item_id),
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        relation TEXT NOT NULL,
        evidence_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS research_findings (
        finding_id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        memory_item_id TEXT REFERENCES research_memory_items(memory_item_id),
        finding_type TEXT NOT NULL,
        headline TEXT NOT NULL,
        detail TEXT NOT NULL,
        severity TEXT NOT NULL,
        evidence_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS program_recommendations (
        recommendation_id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        experiment_job_id TEXT REFERENCES experiment_jobs(experiment_job_id),
        recommendation_type TEXT NOT NULL,
        recommendation TEXT NOT NULL,
        status TEXT NOT NULL,
        confidence REAL NOT NULL DEFAULT 0,
        evidence_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS similar_run_index (
        similar_run_index_id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        experiment_job_id TEXT REFERENCES experiment_jobs(experiment_job_id),
        signature TEXT NOT NULL,
        features_json TEXT NOT NULL,
        source_memory_item_id TEXT REFERENCES research_memory_items(memory_item_id),
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_research_memory_items_account_created
        ON research_memory_items(account_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_research_memory_items_program_type
        ON research_memory_items(program_id, memory_type, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_research_findings_program
        ON research_findings(program_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_program_recommendations_program_status
        ON program_recommendations(program_id, status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_similar_run_index_account_signature
        ON similar_run_index(account_id, signature);
    `,
  },
  {
    version: 25,
    name: "program_report_share_tokens",
    sql: `
      CREATE TABLE IF NOT EXISTS program_report_share_tokens (
        share_id TEXT PRIMARY KEY,
        token_hash TEXT NOT NULL UNIQUE,
        program_report_snapshot_id TEXT NOT NULL REFERENCES program_report_snapshots(program_report_snapshot_id),
        program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        created_by_user_id TEXT NOT NULL REFERENCES users(user_id),
        status TEXT NOT NULL,
        expires_at TEXT,
        revoked_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_program_report_share_tokens_hash
        ON program_report_share_tokens(token_hash);
      CREATE INDEX IF NOT EXISTS idx_program_report_share_tokens_report_status
        ON program_report_share_tokens(program_report_snapshot_id, status);
    `,
  },
  {
    version: 26,
    name: "research_throughput_usage",
    sql: `
      ALTER TABLE usage_snapshots ADD COLUMN programs_created INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE usage_snapshots ADD COLUMN hypotheses_created INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE usage_snapshots ADD COLUMN experiments_queued INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE usage_snapshots ADD COLUMN experiment_compute_units INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE usage_snapshots ADD COLUMN assistant_calls INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE usage_snapshots ADD COLUMN share_links_created INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE usage_snapshots ADD COLUMN research_desk_requests INTEGER NOT NULL DEFAULT 0;
    `,
  },
  {
    version: 27,
    name: "conversational_research_copilot",
    sql: `
      CREATE TABLE IF NOT EXISTS research_conversations (
        conversation_id TEXT PRIMARY KEY,
        program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        created_by_user_id TEXT NOT NULL REFERENCES users(user_id),
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS research_messages (
        message_id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES research_conversations(conversation_id),
        program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        parts_json TEXT NOT NULL,
        status TEXT NOT NULL,
        reply_to_message_id TEXT REFERENCES research_messages(message_id),
        created_by_user_id TEXT REFERENCES users(user_id),
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS research_turns (
        turn_id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES research_conversations(conversation_id),
        program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        user_message_id TEXT NOT NULL REFERENCES research_messages(message_id),
        assistant_message_id TEXT REFERENCES research_messages(message_id),
        provider TEXT NOT NULL,
        model TEXT,
        prompt_version TEXT NOT NULL,
        tool_version TEXT NOT NULL,
        status TEXT NOT NULL,
        mode TEXT,
        prompt_tokens INTEGER,
        completion_tokens INTEGER,
        duration_ms INTEGER,
        error_code TEXT,
        created_at TEXT NOT NULL,
        completed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS research_sources (
        source_id TEXT PRIMARY KEY,
        program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        created_by_user_id TEXT NOT NULL REFERENCES users(user_id),
        source_type TEXT NOT NULL,
        title TEXT NOT NULL,
        canonical_url TEXT,
        file_name TEXT,
        content_type TEXT NOT NULL,
        storage_key TEXT,
        checksum_sha256 TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        status TEXT NOT NULL,
        metadata_json TEXT NOT NULL,
        error_summary TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS research_source_chunks (
        chunk_id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL REFERENCES research_sources(source_id),
        program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        anchor_json TEXT NOT NULL,
        token_estimate INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(source_id, chunk_index)
      );

      CREATE TABLE IF NOT EXISTS conversation_context_snapshots (
        context_snapshot_id TEXT PRIMARY KEY,
        turn_id TEXT NOT NULL REFERENCES research_turns(turn_id),
        conversation_id TEXT NOT NULL REFERENCES research_conversations(conversation_id),
        program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        included_message_ids_json TEXT NOT NULL,
        included_source_chunks_json TEXT NOT NULL,
        included_artifact_ids_json TEXT NOT NULL,
        token_estimate INTEGER NOT NULL,
        policy_version TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS research_tool_calls (
        tool_call_id TEXT PRIMARY KEY,
        turn_id TEXT NOT NULL REFERENCES research_turns(turn_id),
        conversation_id TEXT NOT NULL REFERENCES research_conversations(conversation_id),
        program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        tool_name TEXT NOT NULL,
        arguments_json TEXT NOT NULL,
        result_json TEXT,
        authorization_decision TEXT NOT NULL,
        status TEXT NOT NULL,
        idempotency_key TEXT NOT NULL UNIQUE,
        error_code TEXT,
        created_at TEXT NOT NULL,
        completed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS research_proposals (
        proposal_id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES research_conversations(conversation_id),
        program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        source_message_id TEXT NOT NULL REFERENCES research_messages(message_id),
        proposal_type TEXT NOT NULL,
        status TEXT NOT NULL,
        title TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        provenance_json TEXT NOT NULL,
        version INTEGER NOT NULL,
        content_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        confirmed_at TEXT,
        confirmed_by_user_id TEXT REFERENCES users(user_id)
      );

      CREATE TABLE IF NOT EXISTS research_decisions (
        decision_id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES research_conversations(conversation_id),
        program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        proposal_id TEXT REFERENCES research_proposals(proposal_id),
        actor_user_id TEXT NOT NULL REFERENCES users(user_id),
        decision_type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_research_conversations_program_updated ON research_conversations(program_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_research_messages_conversation_created ON research_messages(conversation_id, created_at ASC);
      CREATE INDEX IF NOT EXISTS idx_research_turns_account_created ON research_turns(account_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_research_sources_program_created ON research_sources(program_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_research_source_chunks_source ON research_source_chunks(source_id, chunk_index);
      CREATE INDEX IF NOT EXISTS idx_research_proposals_program_status ON research_proposals(program_id, status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_research_tool_calls_account_created ON research_tool_calls(account_id, created_at DESC);
    `,
  },
  {
    version: 28,
    name: "canonical_research_lifecycle",
    sql: `
      CREATE TABLE IF NOT EXISTS program_lifecycle_events (
        event_id TEXT PRIMARY KEY,
        program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        schema_version TEXT NOT NULL,
        event_type TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        stage TEXT NOT NULL,
        identity_json TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        actor_json TEXT NOT NULL,
        event_hash TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_program_lifecycle_program_time ON program_lifecycle_events(program_id, occurred_at ASC);
      CREATE INDEX IF NOT EXISTS idx_program_lifecycle_account_type ON program_lifecycle_events(account_id, event_type, occurred_at DESC);
    `,
  },
  {
    version: 29,
    name: "hypothesis_card_executable_spec_bridge",
    sql: `
      CREATE TABLE IF NOT EXISTS hypothesis_cards (
        card_record_id TEXT PRIMARY KEY,
        card_id TEXT NOT NULL,
        program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        source_proposal_id TEXT REFERENCES research_proposals(proposal_id),
        version INTEGER NOT NULL,
        status TEXT NOT NULL,
        card_json TEXT NOT NULL,
        card_hash TEXT NOT NULL,
        validation_errors_json TEXT NOT NULL,
        created_by_user_id TEXT NOT NULL REFERENCES users(user_id),
        created_at TEXT NOT NULL,
        confirmed_at TEXT,
        confirmed_by_user_id TEXT REFERENCES users(user_id),
        UNIQUE(card_id, version),
        UNIQUE(program_id, card_hash)
      );

      CREATE TABLE IF NOT EXISTS research_spec_bundles (
        spec_bundle_id TEXT PRIMARY KEY,
        program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        card_record_id TEXT NOT NULL REFERENCES hypothesis_cards(card_record_id),
        version INTEGER NOT NULL,
        status TEXT NOT NULL,
        bundle_json TEXT NOT NULL,
        bundle_hash TEXT NOT NULL,
        compile_status TEXT NOT NULL,
        compiler_version TEXT NOT NULL,
        validation_errors_json TEXT NOT NULL,
        generated_by_user_id TEXT NOT NULL REFERENCES users(user_id),
        generated_at TEXT NOT NULL,
        approved_at TEXT,
        approved_by_user_id TEXT REFERENCES users(user_id),
        UNIQUE(card_record_id, version),
        UNIQUE(program_id, bundle_hash)
      );

      CREATE TABLE IF NOT EXISTS strategy_implementation_tasks (
        task_id TEXT PRIMARY KEY,
        program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        spec_bundle_id TEXT NOT NULL REFERENCES research_spec_bundles(spec_bundle_id),
        status TEXT NOT NULL,
        task_json TEXT NOT NULL,
        evidence_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        approved_at TEXT,
        approved_by_user_id TEXT REFERENCES users(user_id)
      );

      CREATE INDEX IF NOT EXISTS idx_hypothesis_cards_program_version ON hypothesis_cards(program_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_spec_bundles_program_version ON research_spec_bundles(program_id, generated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_implementation_tasks_program_status ON strategy_implementation_tasks(program_id, status, created_at DESC);
    `,
  },
  {
    version: 30,
    name: "qualification_artifact_copilot_pine_bridge",
    sql: `
      CREATE TABLE IF NOT EXISTS deployment_qualifications (
        qualification_id TEXT PRIMARY KEY, program_id TEXT NOT NULL REFERENCES research_programs(program_id), account_id TEXT NOT NULL REFERENCES accounts(account_id),
        spec_bundle_id TEXT NOT NULL REFERENCES research_spec_bundles(spec_bundle_id), experiment_job_id TEXT, status TEXT NOT NULL,
        strategy_spec_hash TEXT NOT NULL, risk_policy_hash TEXT NOT NULL, config_hash TEXT NOT NULL, snapshot_hash TEXT NOT NULL UNIQUE,
        snapshot_json TEXT NOT NULL, created_by_user_id TEXT NOT NULL REFERENCES users(user_id), created_at TEXT NOT NULL,
        approved_at TEXT, approved_by_user_id TEXT REFERENCES users(user_id)
      );
      CREATE TABLE IF NOT EXISTS program_artifact_catalog (
        catalog_id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(account_id), program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        artifact_type TEXT NOT NULL, object_id TEXT NOT NULL, sensitivity TEXT NOT NULL, content_hash TEXT NOT NULL,
        lineage_json TEXT NOT NULL, summary TEXT NOT NULL, searchable_text TEXT NOT NULL, anchors_json TEXT NOT NULL, table_schema_json TEXT NOT NULL,
        query_payload_json TEXT NOT NULL, units_json TEXT NOT NULL, storage_key TEXT, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        UNIQUE(program_id, artifact_type, object_id, content_hash)
      );
      CREATE TABLE IF NOT EXISTS artifact_context_snapshots (
        artifact_context_snapshot_id TEXT PRIMARY KEY, turn_id TEXT NOT NULL REFERENCES research_turns(turn_id), account_id TEXT NOT NULL REFERENCES accounts(account_id),
        program_id TEXT NOT NULL REFERENCES research_programs(program_id), query_json TEXT NOT NULL, result_json TEXT NOT NULL,
        included_catalog_ids_json TEXT NOT NULL, token_estimate INTEGER NOT NULL, truncated INTEGER NOT NULL, policy_version TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS pine_exports (
        pine_export_id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(account_id), program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        spec_bundle_id TEXT NOT NULL REFERENCES research_spec_bundles(spec_bundle_id), status TEXT NOT NULL, compatibility_status TEXT NOT NULL,
        parity_status TEXT NOT NULL, bundle_hash TEXT NOT NULL, storage_prefix TEXT NOT NULL, manifest_json TEXT NOT NULL,
        created_by_user_id TEXT NOT NULL REFERENCES users(user_id), created_at TEXT NOT NULL, superseded_at TEXT
      );
      CREATE TABLE IF NOT EXISTS pine_imports (
        pine_import_id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(account_id), program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        source_hash TEXT NOT NULL, storage_key TEXT NOT NULL, report_json TEXT NOT NULL, status TEXT NOT NULL, created_by_user_id TEXT NOT NULL REFERENCES users(user_id), created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS pine_parity_results (
        parity_result_id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(account_id), program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        pine_export_id TEXT NOT NULL REFERENCES pine_exports(pine_export_id), report_json TEXT NOT NULL, verdict TEXT NOT NULL, report_hash TEXT NOT NULL UNIQUE,
        created_by_user_id TEXT NOT NULL REFERENCES users(user_id), created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tradingview_webhook_credentials (
        credential_id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(account_id), program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        pine_export_id TEXT NOT NULL REFERENCES pine_exports(pine_export_id), token_hash TEXT NOT NULL UNIQUE, status TEXT NOT NULL, expires_at TEXT,
        created_by_user_id TEXT NOT NULL REFERENCES users(user_id), created_at TEXT NOT NULL, revoked_at TEXT
      );
      CREATE TABLE IF NOT EXISTS tradingview_signal_observations (
        observation_id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(account_id), program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        pine_export_id TEXT NOT NULL REFERENCES pine_exports(pine_export_id), idempotency_key TEXT NOT NULL UNIQUE, payload_hash TEXT NOT NULL,
        observation_json TEXT NOT NULL, verification_status TEXT NOT NULL, received_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_qualifications_program_created ON deployment_qualifications(program_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_artifact_catalog_program_type ON program_artifact_catalog(program_id, artifact_type, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_artifact_catalog_search ON program_artifact_catalog(program_id, searchable_text);
      CREATE INDEX IF NOT EXISTS idx_artifact_context_turn ON artifact_context_snapshots(turn_id);
      CREATE INDEX IF NOT EXISTS idx_pine_exports_program_created ON pine_exports(program_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_pine_observations_export_received ON tradingview_signal_observations(pine_export_id, received_at DESC);
    `,
  },
  {
    version: 31,
    name: "pine_export_jobs_and_operational_indexes",
    sql: `
      CREATE TABLE IF NOT EXISTS pine_export_jobs (
        pine_export_job_id TEXT PRIMARY KEY,
        pine_export_id TEXT NOT NULL,
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        spec_bundle_id TEXT NOT NULL REFERENCES research_spec_bundles(spec_bundle_id),
        status TEXT NOT NULL,
        progress_pct INTEGER NOT NULL,
        error_code TEXT,
        created_by_user_id TEXT NOT NULL REFERENCES users(user_id),
        created_at TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_pine_export_jobs_program_created ON pine_export_jobs(program_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_pine_export_jobs_status_created ON pine_export_jobs(status, created_at);
      CREATE INDEX IF NOT EXISTS idx_pine_credentials_export_status ON tradingview_webhook_credentials(pine_export_id, status);
    `,
  },
  {
    version: 32,
    name: "c3_exchange_connectors_and_deployments",
    sql: `
      CREATE TABLE IF NOT EXISTS exchange_connectors (
        connector_id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(account_id), created_by_user_id TEXT NOT NULL REFERENCES users(user_id),
        venue TEXT NOT NULL, environment TEXT NOT NULL, label TEXT NOT NULL, status TEXT NOT NULL,
        credential_ciphertext TEXT NOT NULL, credential_key_version TEXT NOT NULL, api_key_hint TEXT NOT NULL,
        permissions_json TEXT NOT NULL, doctor_json TEXT NOT NULL, last_checked_at TEXT, last_used_at TEXT,
        revoked_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        UNIQUE(account_id, venue, environment, label)
      );
      CREATE TABLE IF NOT EXISTS strategy_deployments (
        deployment_id TEXT PRIMARY KEY, program_id TEXT NOT NULL REFERENCES research_programs(program_id), account_id TEXT NOT NULL REFERENCES accounts(account_id),
        connector_id TEXT NOT NULL REFERENCES exchange_connectors(connector_id), qualification_id TEXT NOT NULL REFERENCES deployment_qualifications(qualification_id),
        venue TEXT NOT NULL, environment TEXT NOT NULL, status TEXT NOT NULL, symbols_json TEXT NOT NULL,
        strategy_spec_hash TEXT NOT NULL, risk_policy_hash TEXT NOT NULL, config_hash TEXT NOT NULL,
        risk_policy_json TEXT NOT NULL, live_canary_approved INTEGER NOT NULL DEFAULT 0,
        created_by_user_id TEXT NOT NULL REFERENCES users(user_id), approved_by_user_id TEXT, approved_at TEXT,
        last_heartbeat_at TEXT, last_reconciled_at TEXT, frozen_reason TEXT, started_at TEXT, stopped_at TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS deployment_commands (
        command_id TEXT PRIMARY KEY, deployment_id TEXT NOT NULL REFERENCES strategy_deployments(deployment_id), program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        account_id TEXT NOT NULL REFERENCES accounts(account_id), command_type TEXT NOT NULL, status TEXT NOT NULL,
        idempotency_key TEXT NOT NULL UNIQUE, payload_json TEXT NOT NULL, requested_by_user_id TEXT NOT NULL REFERENCES users(user_id),
        available_at TEXT NOT NULL, leased_until TEXT, attempt_count INTEGER NOT NULL DEFAULT 0, max_attempts INTEGER NOT NULL DEFAULT 3,
        error_code TEXT, created_at TEXT NOT NULL, processed_at TEXT
      );
      CREATE TABLE IF NOT EXISTS deployment_events (
        deployment_event_id TEXT PRIMARY KEY, deployment_id TEXT NOT NULL REFERENCES strategy_deployments(deployment_id), program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        account_id TEXT NOT NULL REFERENCES accounts(account_id), event_type TEXT NOT NULL, idempotency_key TEXT NOT NULL UNIQUE,
        correlation_id TEXT NOT NULL, causation_id TEXT, payload_json TEXT NOT NULL, occurred_at TEXT NOT NULL, ingested_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS deployment_projections (
        deployment_id TEXT PRIMARY KEY REFERENCES strategy_deployments(deployment_id), account_id TEXT NOT NULL REFERENCES accounts(account_id),
        health_json TEXT NOT NULL, balances_json TEXT NOT NULL, positions_json TEXT NOT NULL, orders_json TEXT NOT NULL, fills_json TEXT NOT NULL,
        incidents_json TEXT NOT NULL, snapshot_hash TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_exchange_connectors_account ON exchange_connectors(account_id, venue, environment, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_deployments_program ON strategy_deployments(program_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_deployment_commands_claim ON deployment_commands(status, available_at, leased_until);
      CREATE INDEX IF NOT EXISTS idx_deployment_events_timeline ON deployment_events(deployment_id, occurred_at DESC);
    `,
  },
  {
    version: 33,
    name: "exchange_connector_product_type",
    sql: `
      ALTER TABLE exchange_connectors ADD COLUMN product_type TEXT NOT NULL DEFAULT 'perpetual';
      ALTER TABLE strategy_deployments ADD COLUMN product_type TEXT NOT NULL DEFAULT 'perpetual';
      CREATE INDEX IF NOT EXISTS idx_exchange_connectors_product ON exchange_connectors(account_id, venue, environment, product_type, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_deployments_product ON strategy_deployments(account_id, venue, environment, product_type, created_at DESC);
    `,
  },
  {
    version: 34,
    name: "c4_unified_trade_memory",
    sql: `
      CREATE TABLE IF NOT EXISTS decision_state_snapshots (
        state_snapshot_id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(account_id), program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        stage TEXT NOT NULL, strategy_spec_hash TEXT NOT NULL, run_id TEXT, deployment_id TEXT, symbol TEXT NOT NULL,
        decision_at TEXT NOT NULL, captured_at TEXT NOT NULL, features_json TEXT NOT NULL, feature_timestamps_json TEXT NOT NULL,
        missing_features_json TEXT NOT NULL, provenance_json TEXT NOT NULL, future_enriched INTEGER NOT NULL DEFAULT 0,
        snapshot_hash TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS trade_episodes (
        episode_id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(account_id), program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        stage TEXT NOT NULL, run_id TEXT, deployment_id TEXT, strategy_spec_hash TEXT NOT NULL, venue TEXT, environment TEXT, product_type TEXT NOT NULL,
        symbol TEXT NOT NULL, side TEXT NOT NULL, opened_at TEXT NOT NULL, closed_at TEXT, quantity REAL NOT NULL,
        entry_price REAL, exit_price REAL, gross_pnl REAL, fees REAL NOT NULL DEFAULT 0, net_pnl REAL,
        status TEXT NOT NULL, decision_state_snapshot_id TEXT REFERENCES decision_state_snapshots(state_snapshot_id),
        source_event_ids_json TEXT NOT NULL, source_fill_ids_json TEXT NOT NULL, data_quality_json TEXT NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS trade_memory_fill_ledger (
        fill_identity TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(account_id), program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        deployment_id TEXT NOT NULL, episode_id TEXT, fill_json TEXT NOT NULL, processed_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS memory_assessments (
        assessment_id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(account_id), program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        strategy_spec_hash TEXT NOT NULL, current_state_snapshot_id TEXT NOT NULL REFERENCES decision_state_snapshots(state_snapshot_id),
        assessment TEXT NOT NULL, reason_codes_json TEXT NOT NULL, support_count INTEGER NOT NULL, strategy_support_count INTEGER NOT NULL,
        cross_strategy_support_count INTEGER NOT NULL, state_similarity_score REAL, drift_ratio REAL, expected_net_pnl REAL,
        downside_p10_net_pnl REAL, empirical_positive_rate REAL, uncertainty_interval_json TEXT NOT NULL, calibration_json TEXT NOT NULL,
        source_episode_ids_json TEXT NOT NULL, missing_state_features_json TEXT NOT NULL, advisory_only INTEGER NOT NULL DEFAULT 1,
        outcome_episode_id TEXT REFERENCES trade_episodes(episode_id), actual_positive INTEGER, created_at TEXT NOT NULL, calibrated_at TEXT
      );
      CREATE TABLE IF NOT EXISTS canonical_memory_entries (
        canonical_memory_entry_id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(account_id), program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        entry_type TEXT NOT NULL, source_type TEXT NOT NULL, source_id TEXT NOT NULL, status TEXT NOT NULL,
        payload_json TEXT NOT NULL, lineage_json TEXT NOT NULL, content_hash TEXT NOT NULL,
        confirmed_by_user_id TEXT, confirmed_at TEXT, created_at TEXT NOT NULL,
        UNIQUE(account_id, source_type, source_id, content_hash)
      );
      CREATE INDEX IF NOT EXISTS idx_state_snapshots_account_strategy ON decision_state_snapshots(account_id, strategy_spec_hash, decision_at DESC);
      CREATE INDEX IF NOT EXISTS idx_trade_episodes_account_symbol ON trade_episodes(account_id, symbol, closed_at DESC);
      CREATE INDEX IF NOT EXISTS idx_trade_episodes_program_stage ON trade_episodes(program_id, stage, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_memory_assessments_program_created ON memory_assessments(program_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_canonical_memory_program_type ON canonical_memory_entries(program_id, entry_type, created_at DESC);
    `,
  },
  {
    version: 35,
    name: "c5_live_canary_safety",
    sql: `
      CREATE TABLE IF NOT EXISTS deployment_promotions (
        promotion_id TEXT PRIMARY KEY, deployment_id TEXT NOT NULL REFERENCES strategy_deployments(deployment_id), program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        account_id TEXT NOT NULL REFERENCES accounts(account_id), from_stage TEXT NOT NULL, to_stage TEXT NOT NULL, status TEXT NOT NULL,
        evidence_json TEXT NOT NULL, checks_json TEXT NOT NULL, unresolved_json TEXT NOT NULL, evidence_hash TEXT NOT NULL,
        approved_by_user_id TEXT, approved_at TEXT, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS deployment_safety_policies (
        deployment_id TEXT PRIMARY KEY REFERENCES strategy_deployments(deployment_id), account_id TEXT NOT NULL REFERENCES accounts(account_id),
        policy_json TEXT NOT NULL, policy_hash TEXT NOT NULL, status TEXT NOT NULL, approved_by_user_id TEXT, approved_at TEXT,
        kill_switch_tested_at TEXT, recovery_drill_passed_at TEXT, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS deployment_incidents (
        incident_id TEXT PRIMARY KEY, deployment_id TEXT NOT NULL REFERENCES strategy_deployments(deployment_id), program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        account_id TEXT NOT NULL REFERENCES accounts(account_id), incident_type TEXT NOT NULL, severity TEXT NOT NULL, status TEXT NOT NULL,
        summary TEXT NOT NULL, details_json TEXT NOT NULL, source_event_id TEXT, created_at TEXT NOT NULL, resolved_at TEXT, resolved_by_user_id TEXT
      );
      CREATE TABLE IF NOT EXISTS external_alert_deliveries (
        alert_delivery_id TEXT PRIMARY KEY, incident_id TEXT NOT NULL REFERENCES deployment_incidents(incident_id), account_id TEXT NOT NULL REFERENCES accounts(account_id),
        channel TEXT NOT NULL, destination_hint TEXT NOT NULL, status TEXT NOT NULL, attempt_count INTEGER NOT NULL DEFAULT 0,
        error_code TEXT, created_at TEXT NOT NULL, sent_at TEXT
      );
      CREATE TABLE IF NOT EXISTS deployment_recovery_drills (
        recovery_drill_id TEXT PRIMARY KEY, deployment_id TEXT NOT NULL REFERENCES strategy_deployments(deployment_id), account_id TEXT NOT NULL REFERENCES accounts(account_id),
        status TEXT NOT NULL, steps_json TEXT NOT NULL, evidence_json TEXT NOT NULL, requested_by_user_id TEXT NOT NULL, created_at TEXT NOT NULL, completed_at TEXT
      );
      CREATE TABLE IF NOT EXISTS connector_credential_use_audit (
        credential_use_id TEXT PRIMARY KEY, connector_id TEXT NOT NULL REFERENCES exchange_connectors(connector_id), account_id TEXT NOT NULL REFERENCES accounts(account_id),
        worker_instance_id TEXT NOT NULL, purpose TEXT NOT NULL, outcome TEXT NOT NULL, used_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_promotions_deployment_created ON deployment_promotions(deployment_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_incidents_deployment_status ON deployment_incidents(deployment_id, status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_alert_deliveries_status ON external_alert_deliveries(status, created_at);
    `,
  },
  {
    version: 36,
    name: "c6_realtime_portfolio_command",
    sql: `
      CREATE TABLE IF NOT EXISTS portfolio_snapshots (
        portfolio_snapshot_id TEXT PRIMARY KEY, deployment_id TEXT NOT NULL REFERENCES strategy_deployments(deployment_id), program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        account_id TEXT NOT NULL REFERENCES accounts(account_id), source_event_id TEXT NOT NULL REFERENCES deployment_events(deployment_event_id),
        equity REAL, available_balance REAL, margin_used REAL, realized_pnl REAL, unrealized_pnl REAL, drawdown_pct REAL,
        exposure_json TEXT NOT NULL, risk_json TEXT NOT NULL, freshness_json TEXT NOT NULL, snapshot_hash TEXT NOT NULL UNIQUE,
        observed_at TEXT NOT NULL, ingested_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS deployment_audit_actions (
        audit_action_id TEXT PRIMARY KEY, deployment_id TEXT NOT NULL REFERENCES strategy_deployments(deployment_id), program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        account_id TEXT NOT NULL REFERENCES accounts(account_id), action_type TEXT NOT NULL, actor_user_id TEXT NOT NULL,
        payload_json TEXT NOT NULL, occurred_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_program_time ON portfolio_snapshots(program_id, observed_at DESC);
      CREATE INDEX IF NOT EXISTS idx_deployment_events_program_cursor ON deployment_events(program_id, occurred_at, deployment_event_id);
    `,
  },
  {
    version: 37,
    name: "c7_memory_policy_gate",
    sql: `
      CREATE TABLE IF NOT EXISTS memory_policy_configs (
        memory_policy_id TEXT PRIMARY KEY, deployment_id TEXT NOT NULL UNIQUE REFERENCES strategy_deployments(deployment_id), program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        account_id TEXT NOT NULL REFERENCES accounts(account_id), mode TEXT NOT NULL, status TEXT NOT NULL, thresholds_json TEXT NOT NULL,
        policy_hash TEXT NOT NULL, approved_by_user_id TEXT, approved_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS memory_policy_evaluations (
        memory_policy_evaluation_id TEXT PRIMARY KEY, memory_policy_id TEXT NOT NULL REFERENCES memory_policy_configs(memory_policy_id),
        deployment_id TEXT NOT NULL REFERENCES strategy_deployments(deployment_id), program_id TEXT NOT NULL REFERENCES research_programs(program_id),
        account_id TEXT NOT NULL REFERENCES accounts(account_id), assessment_id TEXT REFERENCES memory_assessments(assessment_id), order_intent_id TEXT NOT NULL,
        mode TEXT NOT NULL, would_block INTEGER NOT NULL, applied_block INTEGER NOT NULL, reason_codes_json TEXT NOT NULL,
        requested_quantity REAL NOT NULL, effective_quantity REAL NOT NULL, source_episode_ids_json TEXT NOT NULL,
        outcome TEXT, false_block INTEGER, missed_risk INTEGER, evaluated_at TEXT NOT NULL, resolved_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_memory_policy_eval_deployment_time ON memory_policy_evaluations(deployment_id, evaluated_at DESC);
    `,
  },
  {
    version: 38,
    name: "c8_connector_certification",
    sql: `
      CREATE TABLE IF NOT EXISTS connector_stream_sessions (
        stream_session_id TEXT PRIMARY KEY, connector_id TEXT NOT NULL REFERENCES exchange_connectors(connector_id), account_id TEXT NOT NULL REFERENCES accounts(account_id),
        venue TEXT NOT NULL, environment TEXT NOT NULL, product_type TEXT NOT NULL, status TEXT NOT NULL, private_stream_ready INTEGER NOT NULL,
        last_event_at TEXT, last_reconciled_at TEXT, reconnect_count INTEGER NOT NULL DEFAULT 0, details_json TEXT NOT NULL, started_at TEXT NOT NULL, stopped_at TEXT
      );
      CREATE TABLE IF NOT EXISTS connector_certifications (
        connector_certification_id TEXT PRIMARY KEY, venue TEXT NOT NULL, environment TEXT NOT NULL, product_type TEXT NOT NULL,
        adapter_version TEXT NOT NULL, status TEXT NOT NULL, checks_json TEXT NOT NULL, fault_tests_json TEXT NOT NULL,
        certification_hash TEXT NOT NULL UNIQUE, certified_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_stream_sessions_connector_started ON connector_stream_sessions(connector_id, started_at DESC);
      CREATE INDEX IF NOT EXISTS idx_connector_certifications_scope ON connector_certifications(venue, environment, product_type, certified_at DESC);
    `,
  },
  {
    version: 39,
    name: "cx_assistant_provider_layer",
    sql: `
      CREATE TABLE IF NOT EXISTS llm_provider_connections (
        connection_id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        created_by_user_id TEXT NOT NULL REFERENCES users(user_id),
        provider TEXT NOT NULL,
        label TEXT NOT NULL,
        status TEXT NOT NULL,
        credential_ciphertext TEXT NOT NULL,
        credential_key_version TEXT NOT NULL,
        api_key_hint TEXT NOT NULL,
        default_model TEXT NOT NULL,
        usage_mode TEXT NOT NULL,
        last_checked_at TEXT,
        last_error TEXT,
        last_used_at TEXT,
        revoked_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS llm_provider_audit_events (
        event_id TEXT PRIMARY KEY,
        connection_id TEXT NOT NULL REFERENCES llm_provider_connections(connection_id),
        account_id TEXT NOT NULL REFERENCES accounts(account_id),
        actor_user_id TEXT NOT NULL REFERENCES users(user_id),
        event_type TEXT NOT NULL,
        metadata_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_llm_provider_connections_account_status ON llm_provider_connections(account_id, provider, status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_llm_provider_audit_account_created ON llm_provider_audit_events(account_id, created_at DESC);
    `,
  },
];
