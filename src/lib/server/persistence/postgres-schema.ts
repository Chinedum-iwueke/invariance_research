export const postgresSchemaSql = `
CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  last_login_at TIMESTAMPTZ NOT NULL,
  password_hash TEXT,
  password_updated_at TIMESTAMPTZ,
  email_verified_at TIMESTAMPTZ,
  session_version INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_updated_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS accounts (
  account_id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL UNIQUE REFERENCES users(user_id),
  plan_id TEXT NOT NULL,
  subscription_status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
  subscription_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL UNIQUE REFERENCES accounts(account_id),
  provider TEXT NOT NULL,
  provider_customer_id TEXT NOT NULL,
  provider_subscription_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  status TEXT NOT NULL,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS entitlement_snapshots (
  account_id TEXT PRIMARY KEY REFERENCES accounts(account_id),
  snapshot_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS usage_snapshots (
  account_id TEXT NOT NULL REFERENCES accounts(account_id),
  month_bucket TEXT NOT NULL,
  analyses_created INTEGER NOT NULL,
  artifacts_uploaded INTEGER NOT NULL,
  report_exports INTEGER NOT NULL,
  programs_created INTEGER NOT NULL DEFAULT 0,
  hypotheses_created INTEGER NOT NULL DEFAULT 0,
  experiments_queued INTEGER NOT NULL DEFAULT 0,
  experiment_compute_units INTEGER NOT NULL DEFAULT 0,
  assistant_calls INTEGER NOT NULL DEFAULT 0,
  share_links_created INTEGER NOT NULL DEFAULT 0,
  research_desk_requests INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (account_id, month_bucket)
);

ALTER TABLE usage_snapshots ADD COLUMN IF NOT EXISTS programs_created INTEGER NOT NULL DEFAULT 0;
ALTER TABLE usage_snapshots ADD COLUMN IF NOT EXISTS hypotheses_created INTEGER NOT NULL DEFAULT 0;
ALTER TABLE usage_snapshots ADD COLUMN IF NOT EXISTS experiments_queued INTEGER NOT NULL DEFAULT 0;
ALTER TABLE usage_snapshots ADD COLUMN IF NOT EXISTS experiment_compute_units INTEGER NOT NULL DEFAULT 0;
ALTER TABLE usage_snapshots ADD COLUMN IF NOT EXISTS assistant_calls INTEGER NOT NULL DEFAULT 0;
ALTER TABLE usage_snapshots ADD COLUMN IF NOT EXISTS share_links_created INTEGER NOT NULL DEFAULT 0;
ALTER TABLE usage_snapshots ADD COLUMN IF NOT EXISTS research_desk_requests INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS artifacts (
  artifact_id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(user_id),
  account_id TEXT NOT NULL REFERENCES accounts(account_id),
  analysis_id TEXT,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  storage_key TEXT NOT NULL,
  checksum_sha256 TEXT,
  artifact_kind TEXT NOT NULL,
  richness TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL,
  parsed_artifact_json JSONB NOT NULL,
  eligibility_summary_json JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS analyses (
  analysis_id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(user_id),
  account_id TEXT NOT NULL REFERENCES accounts(account_id),
  status TEXT NOT NULL,
  strategy_name TEXT,
  program_id TEXT,
  artifact_id TEXT NOT NULL REFERENCES artifacts(artifact_id),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  result_json JSONB,
  eligibility_snapshot_json JSONB,
  engine_context_json JSONB,
  benchmark_json JSONB,
  runtime_config_json JSONB,
  failure_code TEXT,
  failure_message TEXT
);

ALTER TABLE analyses ADD COLUMN IF NOT EXISTS program_id TEXT;

CREATE TABLE IF NOT EXISTS analysis_jobs (
  job_id TEXT PRIMARY KEY,
  analysis_id TEXT NOT NULL UNIQUE REFERENCES analyses(analysis_id),
  account_id TEXT,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL,
  progress_pct INTEGER,
  current_step TEXT,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  retry_count INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  available_at TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ,
  leased_until TIMESTAMPTZ,
  last_error TEXT
);

CREATE TABLE IF NOT EXISTS webhook_events (
  webhook_event_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ,
  status TEXT NOT NULL,
  attempt_count INTEGER NOT NULL,
  error_summary TEXT,
  payload_json JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS publications (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  summary TEXT NOT NULL,
  status TEXT NOT NULL,
  published_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL,
  cover_image_url TEXT NOT NULL,
  pdf_url TEXT NOT NULL,
  cover_storage_key TEXT,
  pdf_storage_key TEXT,
  viewer_url TEXT,
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  author_label TEXT,
  estimated_read_time TEXT,
  tags_json JSONB,
  sort_order INTEGER,
  seo_title TEXT,
  seo_description TEXT
);

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
  published_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS waitlist_entries (
  waitlist_entry_id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  normalized_email TEXT NOT NULL,
  name TEXT,
  source_page TEXT NOT NULL,
  role_or_team TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_entries_email_source ON waitlist_entries(normalized_email, source_page);
CREATE INDEX IF NOT EXISTS idx_publications_category_status ON publications(category, status);
CREATE INDEX IF NOT EXISTS idx_publications_published_at ON publications(published_at);
CREATE INDEX IF NOT EXISTS idx_videos_status_category ON videos(status, category);
CREATE INDEX IF NOT EXISTS idx_videos_episode_published ON videos(episode_number, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_claimable ON analysis_jobs(status, available_at, leased_until, created_at);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status_available_at ON analysis_jobs(status, available_at);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_dead_letter ON analysis_jobs(status, finished_at);

CREATE TABLE IF NOT EXISTS auth_tokens (
  token_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(user_id),
  purpose TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_purpose ON auth_tokens(user_id, purpose, expires_at);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id TEXT NOT NULL REFERENCES users(user_id),
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
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
  metadata_json JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor ON admin_audit_log(actor_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  key TEXT NOT NULL,
  route TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (key, route, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_route_window ON rate_limit_buckets(route, window_start);

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
  created_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  available_at TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS exports (
  export_id TEXT PRIMARY KEY,
  analysis_id TEXT NOT NULL REFERENCES analyses(analysis_id),
  program_id TEXT,
  account_id TEXT NOT NULL REFERENCES accounts(account_id),
  requested_by_user_id TEXT NOT NULL REFERENCES users(user_id),
  report_snapshot_id TEXT,
  format TEXT NOT NULL,
  status TEXT NOT NULL,
  storage_key TEXT,
  content_type TEXT,
  file_size_bytes BIGINT,
  checksum_sha256 TEXT,
  error_code TEXT,
  error_message TEXT,
  requested_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE exports ADD COLUMN IF NOT EXISTS program_id TEXT;

CREATE INDEX IF NOT EXISTS idx_export_jobs_status_available_at ON export_jobs(status, available_at);
CREATE INDEX IF NOT EXISTS idx_exports_account_analysis ON exports(account_id, analysis_id);

CREATE TABLE IF NOT EXISTS report_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  analysis_id TEXT NOT NULL REFERENCES analyses(analysis_id),
  program_id TEXT,
  account_id TEXT NOT NULL REFERENCES accounts(account_id),
  status TEXT NOT NULL,
  source_analysis_updated_at TIMESTAMPTZ NOT NULL,
  source_result_checksum TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  warning_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  superseded_at TIMESTAMPTZ
);

ALTER TABLE report_snapshots ADD COLUMN IF NOT EXISTS program_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_report_snapshots_analysis_checksum
  ON report_snapshots(analysis_id, source_result_checksum);
CREATE INDEX IF NOT EXISTS idx_report_snapshots_analysis_status
  ON report_snapshots(analysis_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exports_report_snapshot ON exports(report_snapshot_id);

CREATE TABLE IF NOT EXISTS share_tokens (
  share_id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  report_snapshot_id TEXT NOT NULL REFERENCES report_snapshots(snapshot_id),
  analysis_id TEXT NOT NULL REFERENCES analyses(analysis_id),
  account_id TEXT NOT NULL REFERENCES accounts(account_id),
  created_by_user_id TEXT NOT NULL REFERENCES users(user_id),
  status TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS share_access_events (
  event_id TEXT PRIMARY KEY,
  share_id TEXT,
  token_hash_prefix TEXT NOT NULL,
  report_snapshot_id TEXT,
  outcome TEXT NOT NULL,
  ip_hash TEXT,
  user_agent_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_share_tokens_hash ON share_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_share_tokens_snapshot_status ON share_tokens(report_snapshot_id, status);
CREATE INDEX IF NOT EXISTS idx_share_tokens_expiry ON share_tokens(expires_at, status);
CREATE INDEX IF NOT EXISTS idx_share_tokens_revoked ON share_tokens(revoked_at);
CREATE INDEX IF NOT EXISTS idx_share_access_events_share_created ON share_access_events(share_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_share_access_events_snapshot_created ON share_access_events(report_snapshot_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_share_access_events_created ON share_access_events(created_at);

CREATE TABLE IF NOT EXISTS research_desk_requests (
  request_id TEXT PRIMARY KEY,
  report_snapshot_id TEXT NOT NULL REFERENCES report_snapshots(snapshot_id),
  analysis_id TEXT NOT NULL REFERENCES analyses(analysis_id),
  artifact_id TEXT NOT NULL REFERENCES artifacts(artifact_id),
  account_id TEXT NOT NULL REFERENCES accounts(account_id),
  requested_by_user_id TEXT NOT NULL REFERENCES users(user_id),
  trigger_limitation TEXT NOT NULL,
  requested_services_json JSONB NOT NULL,
  validation_packet_json JSONB NOT NULL,
  status TEXT NOT NULL,
  user_note TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
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
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  approved_at TIMESTAMPTZ
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
  promotion_candidate BOOLEAN NOT NULL,
  promoted_at TIMESTAMPTZ,
  metadata_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_research_desk_requests_status_created ON research_desk_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_research_desk_requests_analysis ON research_desk_requests(analysis_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_research_desk_requests_snapshot ON research_desk_requests(report_snapshot_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviewer_addenda_snapshot ON report_reviewer_addenda(report_snapshot_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_wedge_learning_events_key ON wedge_learning_events(learning_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wedge_learning_events_promotion ON wedge_learning_events(promotion_candidate, created_at DESC);

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
  payload_json JSONB NOT NULL,
  created_by_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_evidence_events_analysis_created
  ON evidence_events(analysis_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_events_account_created
  ON evidence_events(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_events_type_created
  ON evidence_events(event_type, created_at DESC);

CREATE TABLE IF NOT EXISTS prop_evaluation_rule_profiles (
  profile_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(account_id),
  owner_user_id TEXT NOT NULL REFERENCES users(user_id),
  label TEXT NOT NULL,
  firm_label TEXT,
  rules_json JSONB NOT NULL,
  rules_hash TEXT NOT NULL,
  visibility TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS prop_evaluation_rule_snapshots (
  rule_snapshot_id TEXT PRIMARY KEY,
  analysis_id TEXT NOT NULL REFERENCES analyses(analysis_id),
  account_id TEXT NOT NULL REFERENCES accounts(account_id),
  profile_id TEXT,
  source TEXT NOT NULL,
  label TEXT NOT NULL,
  rules_json JSONB NOT NULL,
  rules_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS prop_evaluation_results (
  result_id TEXT PRIMARY KEY,
  analysis_id TEXT NOT NULL REFERENCES analyses(analysis_id),
  account_id TEXT NOT NULL REFERENCES accounts(account_id),
  rule_snapshot_id TEXT NOT NULL REFERENCES prop_evaluation_rule_snapshots(rule_snapshot_id),
  status TEXT NOT NULL,
  verdict TEXT NOT NULL,
  first_breach_json JSONB,
  rule_status_json JSONB NOT NULL,
  target_progress_json JSONB NOT NULL,
  summary_metrics_json JSONB NOT NULL,
  limitation_codes_json JSONB NOT NULL,
  engine_payload_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_prop_rule_profiles_account
  ON prop_evaluation_rule_profiles(account_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_prop_rule_snapshots_analysis
  ON prop_evaluation_rule_snapshots(analysis_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prop_results_analysis
  ON prop_evaluation_results(analysis_id, created_at DESC);

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
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  archived_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS program_members (
  program_id TEXT NOT NULL REFERENCES research_programs(program_id),
  account_id TEXT NOT NULL REFERENCES accounts(account_id),
  user_id TEXT NOT NULL REFERENCES users(user_id),
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
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
  payload_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS program_artifacts (
  program_artifact_id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL REFERENCES research_programs(program_id),
  account_id TEXT NOT NULL REFERENCES accounts(account_id),
  artifact_id TEXT REFERENCES artifacts(artifact_id),
  analysis_id TEXT REFERENCES analyses(analysis_id),
  artifact_role TEXT NOT NULL,
  attached_by_user_id TEXT NOT NULL REFERENCES users(user_id),
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS program_notes (
  note_id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL REFERENCES research_programs(program_id),
  account_id TEXT NOT NULL REFERENCES accounts(account_id),
  author_user_id TEXT NOT NULL REFERENCES users(user_id),
  note_type TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS program_report_snapshots (
  program_report_snapshot_id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL REFERENCES research_programs(program_id),
  account_id TEXT NOT NULL REFERENCES accounts(account_id),
  report_snapshot_id TEXT REFERENCES report_snapshots(snapshot_id),
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS program_clarification_sessions (
  session_id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL REFERENCES research_programs(program_id),
  account_id TEXT NOT NULL REFERENCES accounts(account_id),
  created_by_user_id TEXT NOT NULL REFERENCES users(user_id),
  status TEXT NOT NULL,
  raw_intuition TEXT NOT NULL,
  intake_fields_json JSONB NOT NULL,
  assistant_questions_json JSONB NOT NULL,
  missing_assumptions_json JSONB NOT NULL,
  accepted_answers_json JSONB,
  research_brief_json JSONB,
  provider TEXT NOT NULL,
  model TEXT,
  error_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS research_briefs (
  brief_id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL REFERENCES research_programs(program_id),
  account_id TEXT NOT NULL REFERENCES accounts(account_id),
  clarification_session_id TEXT REFERENCES program_clarification_sessions(session_id),
  version INTEGER NOT NULL,
  status TEXT NOT NULL,
  brief_json JSONB NOT NULL,
  created_by_user_id TEXT NOT NULL REFERENCES users(user_id),
  created_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_research_programs_account_updated ON research_programs(account_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_program_members_user ON program_members(user_id, program_id);
CREATE INDEX IF NOT EXISTS idx_program_events_program_created ON program_events(program_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_program_artifacts_program ON program_artifacts(program_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_program_artifacts_unique_analysis ON program_artifacts(program_id, analysis_id) WHERE analysis_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analyses_program ON analyses(program_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_program_report_snapshots_program ON program_report_snapshots(program_id, created_at DESC);

CREATE TABLE IF NOT EXISTS program_report_share_tokens (
  share_id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  program_report_snapshot_id TEXT NOT NULL REFERENCES program_report_snapshots(program_report_snapshot_id),
  program_id TEXT NOT NULL REFERENCES research_programs(program_id),
  account_id TEXT NOT NULL REFERENCES accounts(account_id),
  created_by_user_id TEXT NOT NULL REFERENCES users(user_id),
  status TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_program_report_share_tokens_hash ON program_report_share_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_program_report_share_tokens_report_status ON program_report_share_tokens(program_report_snapshot_id, status);

CREATE INDEX IF NOT EXISTS idx_clarification_sessions_program_created ON program_clarification_sessions(program_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_research_briefs_program_version ON research_briefs(program_id, version DESC);

CREATE TABLE IF NOT EXISTS hypotheses (
  hypothesis_id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL REFERENCES research_programs(program_id),
  account_id TEXT NOT NULL REFERENCES accounts(account_id),
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  active_version_id TEXT,
  created_by_user_id TEXT NOT NULL REFERENCES users(user_id),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS hypothesis_versions (
  hypothesis_version_id TEXT PRIMARY KEY,
  hypothesis_id TEXT NOT NULL REFERENCES hypotheses(hypothesis_id),
  program_id TEXT NOT NULL REFERENCES research_programs(program_id),
  account_id TEXT NOT NULL REFERENCES accounts(account_id),
  version INTEGER NOT NULL,
  status TEXT NOT NULL,
  source_brief_id TEXT REFERENCES research_briefs(brief_id),
  spec_json JSONB NOT NULL,
  validation_errors_json JSONB NOT NULL,
  created_by_user_id TEXT NOT NULL REFERENCES users(user_id),
  created_at TIMESTAMPTZ NOT NULL,
  approved_at TIMESTAMPTZ,
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
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS strategy_specs (
  strategy_spec_record_id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL REFERENCES research_programs(program_id),
  account_id TEXT NOT NULL REFERENCES accounts(account_id),
  hypothesis_version_id TEXT NOT NULL REFERENCES hypothesis_versions(hypothesis_version_id),
  version INTEGER NOT NULL,
  status TEXT NOT NULL,
  spec_json JSONB NOT NULL,
  validation_errors_json JSONB NOT NULL,
  created_by_user_id TEXT NOT NULL REFERENCES users(user_id),
  created_at TIMESTAMPTZ NOT NULL,
  approved_at TIMESTAMPTZ,
  approved_by_user_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_hypotheses_program_updated ON hypotheses(program_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_hypothesis_versions_program_created ON hypothesis_versions(program_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hypothesis_approvals_version ON hypothesis_approvals(hypothesis_version_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_strategy_specs_program_created ON strategy_specs(program_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_strategy_specs_hypothesis_version ON strategy_specs(hypothesis_version_id, created_at DESC);

CREATE TABLE IF NOT EXISTS experiment_plans (
  experiment_plan_id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL REFERENCES research_programs(program_id),
  account_id TEXT NOT NULL REFERENCES accounts(account_id),
  strategy_spec_record_id TEXT NOT NULL REFERENCES strategy_specs(strategy_spec_record_id),
  hypothesis_version_id TEXT NOT NULL REFERENCES hypothesis_versions(hypothesis_version_id),
  status TEXT NOT NULL,
  plan_json JSONB NOT NULL,
  validation_errors_json JSONB NOT NULL,
  created_by_user_id TEXT NOT NULL REFERENCES users(user_id),
  created_at TIMESTAMPTZ NOT NULL,
  approved_at TIMESTAMPTZ,
  approved_by_user_id TEXT,
  queued_at TIMESTAMPTZ
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
  required_datasets_json JSONB NOT NULL,
  runtime_budget_json JSONB NOT NULL,
  config_patch_json JSONB NOT NULL,
  falsification_question TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  queued_at TIMESTAMPTZ
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
  available_at TIMESTAMPTZ NOT NULL,
  leased_until TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS experiment_job_events (
  experiment_job_event_id TEXT PRIMARY KEY,
  experiment_job_id TEXT NOT NULL REFERENCES experiment_jobs(experiment_job_id),
  experiment_plan_id TEXT NOT NULL REFERENCES experiment_plans(experiment_plan_id),
  program_id TEXT NOT NULL REFERENCES research_programs(program_id),
  account_id TEXT NOT NULL REFERENCES accounts(account_id),
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  actor_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_experiment_plans_program_created ON experiment_plans(program_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_experiment_plan_items_plan ON experiment_plan_items(experiment_plan_id, priority DESC);
CREATE INDEX IF NOT EXISTS idx_experiment_jobs_claimable ON experiment_jobs(status, priority DESC, available_at, created_at);
CREATE INDEX IF NOT EXISTS idx_experiment_jobs_account_status ON experiment_jobs(account_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_experiment_job_events_job ON experiment_job_events(experiment_job_id, created_at DESC);

CREATE TABLE IF NOT EXISTS research_memory_items (
  memory_item_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(account_id),
  program_id TEXT NOT NULL REFERENCES research_programs(program_id),
  experiment_job_id TEXT REFERENCES experiment_jobs(experiment_job_id),
  memory_type TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  status TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL DEFAULT 0,
  source_event_id TEXT,
  source_card_type TEXT,
  source_json JSONB NOT NULL,
  tags_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS research_memory_links (
  memory_link_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(account_id),
  source_memory_item_id TEXT NOT NULL REFERENCES research_memory_items(memory_item_id),
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  relation TEXT NOT NULL,
  evidence_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
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
  evidence_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS program_recommendations (
  recommendation_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(account_id),
  program_id TEXT NOT NULL REFERENCES research_programs(program_id),
  experiment_job_id TEXT REFERENCES experiment_jobs(experiment_job_id),
  recommendation_type TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  status TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL DEFAULT 0,
  evidence_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS similar_run_index (
  similar_run_index_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(account_id),
  program_id TEXT NOT NULL REFERENCES research_programs(program_id),
  experiment_job_id TEXT REFERENCES experiment_jobs(experiment_job_id),
  signature TEXT NOT NULL,
  features_json JSONB NOT NULL,
  source_memory_item_id TEXT REFERENCES research_memory_items(memory_item_id),
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_research_memory_items_account_created ON research_memory_items(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_research_memory_items_program_type ON research_memory_items(program_id, memory_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_research_findings_program ON research_findings(program_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_program_recommendations_program_status ON program_recommendations(program_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_similar_run_index_account_signature ON similar_run_index(account_id, signature);

CREATE TABLE IF NOT EXISTS worker_heartbeats (
  worker_type TEXT NOT NULL,
  instance_id TEXT NOT NULL,
  status TEXT NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  last_job_id TEXT,
  last_job_status TEXT,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (worker_type, instance_id)
);
`;
