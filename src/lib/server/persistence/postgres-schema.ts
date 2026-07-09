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

CREATE TABLE IF NOT EXISTS research_conversations (
  conversation_id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL REFERENCES research_programs(program_id),
  account_id TEXT NOT NULL REFERENCES accounts(account_id),
  created_by_user_id TEXT NOT NULL REFERENCES users(user_id),
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS research_messages (
  message_id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES research_conversations(conversation_id),
  program_id TEXT NOT NULL REFERENCES research_programs(program_id),
  account_id TEXT NOT NULL REFERENCES accounts(account_id),
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  parts_json JSONB NOT NULL,
  status TEXT NOT NULL,
  reply_to_message_id TEXT REFERENCES research_messages(message_id),
  created_by_user_id TEXT REFERENCES users(user_id),
  created_at TIMESTAMPTZ NOT NULL
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
  created_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ
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
  size_bytes BIGINT NOT NULL,
  status TEXT NOT NULL,
  metadata_json JSONB NOT NULL,
  error_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS research_source_chunks (
  chunk_id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES research_sources(source_id),
  program_id TEXT NOT NULL REFERENCES research_programs(program_id),
  account_id TEXT NOT NULL REFERENCES accounts(account_id),
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  anchor_json JSONB NOT NULL,
  token_estimate INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE(source_id, chunk_index)
);

CREATE TABLE IF NOT EXISTS conversation_context_snapshots (
  context_snapshot_id TEXT PRIMARY KEY,
  turn_id TEXT NOT NULL REFERENCES research_turns(turn_id),
  conversation_id TEXT NOT NULL REFERENCES research_conversations(conversation_id),
  program_id TEXT NOT NULL REFERENCES research_programs(program_id),
  account_id TEXT NOT NULL REFERENCES accounts(account_id),
  included_message_ids_json JSONB NOT NULL,
  included_source_chunks_json JSONB NOT NULL,
  included_artifact_ids_json JSONB NOT NULL,
  token_estimate INTEGER NOT NULL,
  policy_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS research_tool_calls (
  tool_call_id TEXT PRIMARY KEY,
  turn_id TEXT NOT NULL REFERENCES research_turns(turn_id),
  conversation_id TEXT NOT NULL REFERENCES research_conversations(conversation_id),
  program_id TEXT NOT NULL REFERENCES research_programs(program_id),
  account_id TEXT NOT NULL REFERENCES accounts(account_id),
  tool_name TEXT NOT NULL,
  arguments_json JSONB NOT NULL,
  result_json JSONB,
  authorization_decision TEXT NOT NULL,
  status TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ
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
  payload_json JSONB NOT NULL,
  provenance_json JSONB NOT NULL,
  version INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  confirmed_at TIMESTAMPTZ,
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
  payload_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_research_conversations_program_updated ON research_conversations(program_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_research_messages_conversation_created ON research_messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_research_turns_account_created ON research_turns(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_research_sources_program_created ON research_sources(program_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_research_source_chunks_source ON research_source_chunks(source_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_research_proposals_program_status ON research_proposals(program_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_research_tool_calls_account_created ON research_tool_calls(account_id, created_at DESC);

CREATE TABLE IF NOT EXISTS program_lifecycle_events (
  event_id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL REFERENCES research_programs(program_id),
  account_id TEXT NOT NULL REFERENCES accounts(account_id),
  schema_version TEXT NOT NULL,
  event_type TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  stage TEXT NOT NULL,
  identity_json JSONB NOT NULL,
  payload_json JSONB NOT NULL,
  actor_json JSONB NOT NULL,
  event_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_program_lifecycle_program_time ON program_lifecycle_events(program_id, occurred_at ASC);
CREATE INDEX IF NOT EXISTS idx_program_lifecycle_account_type ON program_lifecycle_events(account_id, event_type, occurred_at DESC);

CREATE TABLE IF NOT EXISTS hypothesis_cards (
  card_record_id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL,
  program_id TEXT NOT NULL REFERENCES research_programs(program_id),
  account_id TEXT NOT NULL REFERENCES accounts(account_id),
  source_proposal_id TEXT REFERENCES research_proposals(proposal_id),
  version INTEGER NOT NULL,
  status TEXT NOT NULL,
  card_json JSONB NOT NULL,
  card_hash TEXT NOT NULL,
  validation_errors_json JSONB NOT NULL,
  created_by_user_id TEXT NOT NULL REFERENCES users(user_id),
  created_at TIMESTAMPTZ NOT NULL,
  confirmed_at TIMESTAMPTZ,
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
  bundle_json JSONB NOT NULL,
  bundle_hash TEXT NOT NULL,
  compile_status TEXT NOT NULL,
  compiler_version TEXT NOT NULL,
  validation_errors_json JSONB NOT NULL,
  generated_by_user_id TEXT NOT NULL REFERENCES users(user_id),
  generated_at TIMESTAMPTZ NOT NULL,
  approved_at TIMESTAMPTZ,
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
  task_json JSONB NOT NULL,
  evidence_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  approved_at TIMESTAMPTZ,
  approved_by_user_id TEXT REFERENCES users(user_id)
);
CREATE INDEX IF NOT EXISTS idx_hypothesis_cards_program_version ON hypothesis_cards(program_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_spec_bundles_program_version ON research_spec_bundles(program_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_implementation_tasks_program_status ON strategy_implementation_tasks(program_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS deployment_qualifications (
  qualification_id TEXT PRIMARY KEY, program_id TEXT NOT NULL REFERENCES research_programs(program_id), account_id TEXT NOT NULL REFERENCES accounts(account_id),
  spec_bundle_id TEXT NOT NULL REFERENCES research_spec_bundles(spec_bundle_id), experiment_job_id TEXT, status TEXT NOT NULL,
  strategy_spec_hash TEXT NOT NULL, risk_policy_hash TEXT NOT NULL, config_hash TEXT NOT NULL, snapshot_hash TEXT NOT NULL UNIQUE,
  snapshot_json JSONB NOT NULL, created_by_user_id TEXT NOT NULL REFERENCES users(user_id), created_at TIMESTAMPTZ NOT NULL,
  approved_at TIMESTAMPTZ, approved_by_user_id TEXT REFERENCES users(user_id)
);
CREATE TABLE IF NOT EXISTS program_artifact_catalog (
  catalog_id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(account_id), program_id TEXT NOT NULL REFERENCES research_programs(program_id),
  artifact_type TEXT NOT NULL, object_id TEXT NOT NULL, sensitivity TEXT NOT NULL, content_hash TEXT NOT NULL,
  lineage_json JSONB NOT NULL, summary TEXT NOT NULL, searchable_text TEXT NOT NULL, anchors_json JSONB NOT NULL, table_schema_json JSONB NOT NULL,
  query_payload_json JSONB NOT NULL, units_json JSONB NOT NULL, storage_key TEXT, status TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE(program_id, artifact_type, object_id, content_hash)
);
CREATE TABLE IF NOT EXISTS artifact_context_snapshots (
  artifact_context_snapshot_id TEXT PRIMARY KEY, turn_id TEXT NOT NULL REFERENCES research_turns(turn_id), account_id TEXT NOT NULL REFERENCES accounts(account_id),
  program_id TEXT NOT NULL REFERENCES research_programs(program_id), query_json JSONB NOT NULL, result_json JSONB NOT NULL,
  included_catalog_ids_json JSONB NOT NULL, token_estimate INTEGER NOT NULL, truncated BOOLEAN NOT NULL, policy_version TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS pine_exports (
  pine_export_id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(account_id), program_id TEXT NOT NULL REFERENCES research_programs(program_id),
  spec_bundle_id TEXT NOT NULL REFERENCES research_spec_bundles(spec_bundle_id), status TEXT NOT NULL, compatibility_status TEXT NOT NULL,
  parity_status TEXT NOT NULL, bundle_hash TEXT NOT NULL, storage_prefix TEXT NOT NULL, manifest_json JSONB NOT NULL,
  created_by_user_id TEXT NOT NULL REFERENCES users(user_id), created_at TIMESTAMPTZ NOT NULL, superseded_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS pine_export_jobs (
  pine_export_job_id TEXT PRIMARY KEY, pine_export_id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(account_id), program_id TEXT NOT NULL REFERENCES research_programs(program_id),
  spec_bundle_id TEXT NOT NULL REFERENCES research_spec_bundles(spec_bundle_id), status TEXT NOT NULL, progress_pct INTEGER NOT NULL,
  error_code TEXT, created_by_user_id TEXT NOT NULL REFERENCES users(user_id), created_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ, finished_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS pine_imports (
  pine_import_id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(account_id), program_id TEXT NOT NULL REFERENCES research_programs(program_id),
  source_hash TEXT NOT NULL, storage_key TEXT NOT NULL, report_json JSONB NOT NULL, status TEXT NOT NULL, created_by_user_id TEXT NOT NULL REFERENCES users(user_id), created_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS pine_parity_results (
  parity_result_id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(account_id), program_id TEXT NOT NULL REFERENCES research_programs(program_id),
  pine_export_id TEXT NOT NULL REFERENCES pine_exports(pine_export_id), report_json JSONB NOT NULL, verdict TEXT NOT NULL, report_hash TEXT NOT NULL UNIQUE,
  created_by_user_id TEXT NOT NULL REFERENCES users(user_id), created_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS tradingview_webhook_credentials (
  credential_id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(account_id), program_id TEXT NOT NULL REFERENCES research_programs(program_id),
  pine_export_id TEXT NOT NULL REFERENCES pine_exports(pine_export_id), token_hash TEXT NOT NULL UNIQUE, status TEXT NOT NULL, expires_at TIMESTAMPTZ,
  created_by_user_id TEXT NOT NULL REFERENCES users(user_id), created_at TIMESTAMPTZ NOT NULL, revoked_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS tradingview_signal_observations (
  observation_id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(account_id), program_id TEXT NOT NULL REFERENCES research_programs(program_id),
  pine_export_id TEXT NOT NULL REFERENCES pine_exports(pine_export_id), idempotency_key TEXT NOT NULL UNIQUE, payload_hash TEXT NOT NULL,
  observation_json JSONB NOT NULL, verification_status TEXT NOT NULL, received_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_qualifications_program_created ON deployment_qualifications(program_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_artifact_catalog_program_type ON program_artifact_catalog(program_id, artifact_type, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_artifact_context_turn ON artifact_context_snapshots(turn_id);
CREATE INDEX IF NOT EXISTS idx_pine_exports_program_created ON pine_exports(program_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pine_export_jobs_program_created ON pine_export_jobs(program_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pine_export_jobs_status_created ON pine_export_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_pine_credentials_export_status ON tradingview_webhook_credentials(pine_export_id, status);
CREATE INDEX IF NOT EXISTS idx_pine_observations_export_received ON tradingview_signal_observations(pine_export_id, received_at DESC);

CREATE TABLE IF NOT EXISTS exchange_connectors (
  connector_id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(account_id), created_by_user_id TEXT NOT NULL REFERENCES users(user_id),
  venue TEXT NOT NULL, environment TEXT NOT NULL, label TEXT NOT NULL, status TEXT NOT NULL,
  credential_ciphertext TEXT NOT NULL, credential_key_version TEXT NOT NULL, api_key_hint TEXT NOT NULL,
  permissions_json JSONB NOT NULL, doctor_json JSONB NOT NULL, last_checked_at TIMESTAMPTZ, last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL, product_type TEXT NOT NULL DEFAULT 'perpetual',
  UNIQUE(account_id, venue, environment, label)
);
CREATE TABLE IF NOT EXISTS strategy_deployments (
  deployment_id TEXT PRIMARY KEY, program_id TEXT NOT NULL REFERENCES research_programs(program_id), account_id TEXT NOT NULL REFERENCES accounts(account_id),
  connector_id TEXT NOT NULL REFERENCES exchange_connectors(connector_id), qualification_id TEXT NOT NULL REFERENCES deployment_qualifications(qualification_id),
  venue TEXT NOT NULL, environment TEXT NOT NULL, status TEXT NOT NULL, symbols_json JSONB NOT NULL,
  strategy_spec_hash TEXT NOT NULL, risk_policy_hash TEXT NOT NULL, config_hash TEXT NOT NULL,
  risk_policy_json JSONB NOT NULL, live_canary_approved BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_user_id TEXT NOT NULL REFERENCES users(user_id), approved_by_user_id TEXT, approved_at TIMESTAMPTZ,
  last_heartbeat_at TIMESTAMPTZ, last_reconciled_at TIMESTAMPTZ, frozen_reason TEXT, started_at TIMESTAMPTZ, stopped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL, product_type TEXT NOT NULL DEFAULT 'perpetual'
);
CREATE TABLE IF NOT EXISTS deployment_commands (
  command_id TEXT PRIMARY KEY, deployment_id TEXT NOT NULL REFERENCES strategy_deployments(deployment_id), program_id TEXT NOT NULL REFERENCES research_programs(program_id),
  account_id TEXT NOT NULL REFERENCES accounts(account_id), command_type TEXT NOT NULL, status TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE, payload_json JSONB NOT NULL, requested_by_user_id TEXT NOT NULL REFERENCES users(user_id),
  available_at TIMESTAMPTZ NOT NULL, leased_until TIMESTAMPTZ, attempt_count INTEGER NOT NULL DEFAULT 0, max_attempts INTEGER NOT NULL DEFAULT 3,
  error_code TEXT, created_at TIMESTAMPTZ NOT NULL, processed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS deployment_events (
  deployment_event_id TEXT PRIMARY KEY, deployment_id TEXT NOT NULL REFERENCES strategy_deployments(deployment_id), program_id TEXT NOT NULL REFERENCES research_programs(program_id),
  account_id TEXT NOT NULL REFERENCES accounts(account_id), event_type TEXT NOT NULL, idempotency_key TEXT NOT NULL UNIQUE,
  correlation_id TEXT NOT NULL, causation_id TEXT, payload_json JSONB NOT NULL, occurred_at TIMESTAMPTZ NOT NULL, ingested_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS deployment_projections (
  deployment_id TEXT PRIMARY KEY REFERENCES strategy_deployments(deployment_id), account_id TEXT NOT NULL REFERENCES accounts(account_id),
  health_json JSONB NOT NULL, balances_json JSONB NOT NULL, positions_json JSONB NOT NULL, orders_json JSONB NOT NULL, fills_json JSONB NOT NULL,
  incidents_json JSONB NOT NULL, snapshot_hash TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_exchange_connectors_account ON exchange_connectors(account_id, venue, environment, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deployments_program ON strategy_deployments(program_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deployment_commands_claim ON deployment_commands(status, available_at, leased_until);
CREATE INDEX IF NOT EXISTS idx_deployment_events_timeline ON deployment_events(deployment_id, occurred_at DESC);
ALTER TABLE exchange_connectors ADD COLUMN IF NOT EXISTS product_type TEXT NOT NULL DEFAULT 'perpetual';
ALTER TABLE strategy_deployments ADD COLUMN IF NOT EXISTS product_type TEXT NOT NULL DEFAULT 'perpetual';
CREATE INDEX IF NOT EXISTS idx_exchange_connectors_product ON exchange_connectors(account_id, venue, environment, product_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deployments_product ON strategy_deployments(account_id, venue, environment, product_type, created_at DESC);

CREATE TABLE IF NOT EXISTS decision_state_snapshots (
  state_snapshot_id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(account_id), program_id TEXT NOT NULL REFERENCES research_programs(program_id),
  stage TEXT NOT NULL, strategy_spec_hash TEXT NOT NULL, run_id TEXT, deployment_id TEXT, symbol TEXT NOT NULL,
  decision_at TIMESTAMPTZ NOT NULL, captured_at TIMESTAMPTZ NOT NULL, features_json JSONB NOT NULL, feature_timestamps_json JSONB NOT NULL,
  missing_features_json JSONB NOT NULL, provenance_json JSONB NOT NULL, future_enriched BOOLEAN NOT NULL DEFAULT FALSE,
  snapshot_hash TEXT NOT NULL UNIQUE, created_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS trade_episodes (
  episode_id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(account_id), program_id TEXT NOT NULL REFERENCES research_programs(program_id),
  stage TEXT NOT NULL, run_id TEXT, deployment_id TEXT, strategy_spec_hash TEXT NOT NULL, venue TEXT, environment TEXT, product_type TEXT NOT NULL,
  symbol TEXT NOT NULL, side TEXT NOT NULL, opened_at TIMESTAMPTZ NOT NULL, closed_at TIMESTAMPTZ, quantity DOUBLE PRECISION NOT NULL,
  entry_price DOUBLE PRECISION, exit_price DOUBLE PRECISION, gross_pnl DOUBLE PRECISION, fees DOUBLE PRECISION NOT NULL DEFAULT 0, net_pnl DOUBLE PRECISION,
  status TEXT NOT NULL, decision_state_snapshot_id TEXT REFERENCES decision_state_snapshots(state_snapshot_id),
  source_event_ids_json JSONB NOT NULL, source_fill_ids_json JSONB NOT NULL, data_quality_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS trade_memory_fill_ledger (
  fill_identity TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(account_id), program_id TEXT NOT NULL REFERENCES research_programs(program_id),
  deployment_id TEXT NOT NULL, episode_id TEXT, fill_json JSONB NOT NULL, processed_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS memory_assessments (
  assessment_id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(account_id), program_id TEXT NOT NULL REFERENCES research_programs(program_id),
  strategy_spec_hash TEXT NOT NULL, current_state_snapshot_id TEXT NOT NULL REFERENCES decision_state_snapshots(state_snapshot_id),
  assessment TEXT NOT NULL, reason_codes_json JSONB NOT NULL, support_count INTEGER NOT NULL, strategy_support_count INTEGER NOT NULL,
  cross_strategy_support_count INTEGER NOT NULL, state_similarity_score DOUBLE PRECISION, drift_ratio DOUBLE PRECISION, expected_net_pnl DOUBLE PRECISION,
  downside_p10_net_pnl DOUBLE PRECISION, empirical_positive_rate DOUBLE PRECISION, uncertainty_interval_json JSONB NOT NULL, calibration_json JSONB NOT NULL,
  source_episode_ids_json JSONB NOT NULL, missing_state_features_json JSONB NOT NULL, advisory_only BOOLEAN NOT NULL DEFAULT TRUE,
  outcome_episode_id TEXT REFERENCES trade_episodes(episode_id), actual_positive BOOLEAN, created_at TIMESTAMPTZ NOT NULL, calibrated_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS canonical_memory_entries (
  canonical_memory_entry_id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(account_id), program_id TEXT NOT NULL REFERENCES research_programs(program_id),
  entry_type TEXT NOT NULL, source_type TEXT NOT NULL, source_id TEXT NOT NULL, status TEXT NOT NULL,
  payload_json JSONB NOT NULL, lineage_json JSONB NOT NULL, content_hash TEXT NOT NULL,
  confirmed_by_user_id TEXT, confirmed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL,
  UNIQUE(account_id, source_type, source_id, content_hash)
);
CREATE INDEX IF NOT EXISTS idx_state_snapshots_account_strategy ON decision_state_snapshots(account_id, strategy_spec_hash, decision_at DESC);
CREATE INDEX IF NOT EXISTS idx_trade_episodes_account_symbol ON trade_episodes(account_id, symbol, closed_at DESC);
CREATE INDEX IF NOT EXISTS idx_trade_episodes_program_stage ON trade_episodes(program_id, stage, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_assessments_program_created ON memory_assessments(program_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_canonical_memory_program_type ON canonical_memory_entries(program_id, entry_type, created_at DESC);

CREATE TABLE IF NOT EXISTS deployment_promotions (
  promotion_id TEXT PRIMARY KEY, deployment_id TEXT NOT NULL REFERENCES strategy_deployments(deployment_id), program_id TEXT NOT NULL REFERENCES research_programs(program_id),
  account_id TEXT NOT NULL REFERENCES accounts(account_id), from_stage TEXT NOT NULL, to_stage TEXT NOT NULL, status TEXT NOT NULL,
  evidence_json JSONB NOT NULL, checks_json JSONB NOT NULL, unresolved_json JSONB NOT NULL, evidence_hash TEXT NOT NULL,
  approved_by_user_id TEXT, approved_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS deployment_safety_policies (
  deployment_id TEXT PRIMARY KEY REFERENCES strategy_deployments(deployment_id), account_id TEXT NOT NULL REFERENCES accounts(account_id),
  policy_json JSONB NOT NULL, policy_hash TEXT NOT NULL, status TEXT NOT NULL, approved_by_user_id TEXT, approved_at TIMESTAMPTZ,
  kill_switch_tested_at TIMESTAMPTZ, recovery_drill_passed_at TIMESTAMPTZ, updated_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS deployment_incidents (
  incident_id TEXT PRIMARY KEY, deployment_id TEXT NOT NULL REFERENCES strategy_deployments(deployment_id), program_id TEXT NOT NULL REFERENCES research_programs(program_id),
  account_id TEXT NOT NULL REFERENCES accounts(account_id), incident_type TEXT NOT NULL, severity TEXT NOT NULL, status TEXT NOT NULL,
  summary TEXT NOT NULL, details_json JSONB NOT NULL, source_event_id TEXT, created_at TIMESTAMPTZ NOT NULL, resolved_at TIMESTAMPTZ, resolved_by_user_id TEXT
);
CREATE TABLE IF NOT EXISTS external_alert_deliveries (
  alert_delivery_id TEXT PRIMARY KEY, incident_id TEXT NOT NULL REFERENCES deployment_incidents(incident_id), account_id TEXT NOT NULL REFERENCES accounts(account_id),
  channel TEXT NOT NULL, destination_hint TEXT NOT NULL, status TEXT NOT NULL, attempt_count INTEGER NOT NULL DEFAULT 0,
  error_code TEXT, created_at TIMESTAMPTZ NOT NULL, sent_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS deployment_recovery_drills (
  recovery_drill_id TEXT PRIMARY KEY, deployment_id TEXT NOT NULL REFERENCES strategy_deployments(deployment_id), account_id TEXT NOT NULL REFERENCES accounts(account_id),
  status TEXT NOT NULL, steps_json JSONB NOT NULL, evidence_json JSONB NOT NULL, requested_by_user_id TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL, completed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS connector_credential_use_audit (
  credential_use_id TEXT PRIMARY KEY, connector_id TEXT NOT NULL REFERENCES exchange_connectors(connector_id), account_id TEXT NOT NULL REFERENCES accounts(account_id),
  worker_instance_id TEXT NOT NULL, purpose TEXT NOT NULL, outcome TEXT NOT NULL, used_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_promotions_deployment_created ON deployment_promotions(deployment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_deployment_status ON deployment_incidents(deployment_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_deliveries_status ON external_alert_deliveries(status, created_at);

CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  portfolio_snapshot_id TEXT PRIMARY KEY, deployment_id TEXT NOT NULL REFERENCES strategy_deployments(deployment_id), program_id TEXT NOT NULL REFERENCES research_programs(program_id),
  account_id TEXT NOT NULL REFERENCES accounts(account_id), source_event_id TEXT NOT NULL REFERENCES deployment_events(deployment_event_id),
  equity DOUBLE PRECISION, available_balance DOUBLE PRECISION, margin_used DOUBLE PRECISION, realized_pnl DOUBLE PRECISION, unrealized_pnl DOUBLE PRECISION, drawdown_pct DOUBLE PRECISION,
  exposure_json JSONB NOT NULL, risk_json JSONB NOT NULL, freshness_json JSONB NOT NULL, snapshot_hash TEXT NOT NULL UNIQUE,
  observed_at TIMESTAMPTZ NOT NULL, ingested_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS deployment_audit_actions (
  audit_action_id TEXT PRIMARY KEY, deployment_id TEXT NOT NULL REFERENCES strategy_deployments(deployment_id), program_id TEXT NOT NULL REFERENCES research_programs(program_id),
  account_id TEXT NOT NULL REFERENCES accounts(account_id), action_type TEXT NOT NULL, actor_user_id TEXT NOT NULL,
  payload_json JSONB NOT NULL, occurred_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_program_time ON portfolio_snapshots(program_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_deployment_events_program_cursor ON deployment_events(program_id, occurred_at, deployment_event_id);

CREATE TABLE IF NOT EXISTS memory_policy_configs (
  memory_policy_id TEXT PRIMARY KEY, deployment_id TEXT NOT NULL UNIQUE REFERENCES strategy_deployments(deployment_id), program_id TEXT NOT NULL REFERENCES research_programs(program_id),
  account_id TEXT NOT NULL REFERENCES accounts(account_id), mode TEXT NOT NULL, status TEXT NOT NULL, thresholds_json JSONB NOT NULL,
  policy_hash TEXT NOT NULL, approved_by_user_id TEXT, approved_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS memory_policy_evaluations (
  memory_policy_evaluation_id TEXT PRIMARY KEY, memory_policy_id TEXT NOT NULL REFERENCES memory_policy_configs(memory_policy_id),
  deployment_id TEXT NOT NULL REFERENCES strategy_deployments(deployment_id), program_id TEXT NOT NULL REFERENCES research_programs(program_id),
  account_id TEXT NOT NULL REFERENCES accounts(account_id), assessment_id TEXT REFERENCES memory_assessments(assessment_id), order_intent_id TEXT NOT NULL,
  mode TEXT NOT NULL, would_block BOOLEAN NOT NULL, applied_block BOOLEAN NOT NULL, reason_codes_json JSONB NOT NULL,
  requested_quantity DOUBLE PRECISION NOT NULL, effective_quantity DOUBLE PRECISION NOT NULL, source_episode_ids_json JSONB NOT NULL,
  outcome TEXT, false_block BOOLEAN, missed_risk BOOLEAN, evaluated_at TIMESTAMPTZ NOT NULL, resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_memory_policy_eval_deployment_time ON memory_policy_evaluations(deployment_id, evaluated_at DESC);

CREATE TABLE IF NOT EXISTS connector_stream_sessions (
  stream_session_id TEXT PRIMARY KEY, connector_id TEXT NOT NULL REFERENCES exchange_connectors(connector_id), account_id TEXT NOT NULL REFERENCES accounts(account_id),
  venue TEXT NOT NULL, environment TEXT NOT NULL, product_type TEXT NOT NULL, status TEXT NOT NULL, private_stream_ready BOOLEAN NOT NULL,
  last_event_at TIMESTAMPTZ, last_reconciled_at TIMESTAMPTZ, reconnect_count INTEGER NOT NULL DEFAULT 0, details_json JSONB NOT NULL, started_at TIMESTAMPTZ NOT NULL, stopped_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS connector_certifications (
  connector_certification_id TEXT PRIMARY KEY, venue TEXT NOT NULL, environment TEXT NOT NULL, product_type TEXT NOT NULL,
  adapter_version TEXT NOT NULL, status TEXT NOT NULL, checks_json JSONB NOT NULL, fault_tests_json JSONB NOT NULL,
  certification_hash TEXT NOT NULL UNIQUE, certified_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stream_sessions_connector_started ON connector_stream_sessions(connector_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_connector_certifications_scope ON connector_certifications(venue, environment, product_type, certified_at DESC);

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
  last_checked_at TIMESTAMPTZ,
  last_error TEXT,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS llm_provider_audit_events (
  event_id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL REFERENCES llm_provider_connections(connection_id),
  account_id TEXT NOT NULL REFERENCES accounts(account_id),
  actor_user_id TEXT NOT NULL REFERENCES users(user_id),
  event_type TEXT NOT NULL,
  metadata_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_llm_provider_connections_account_status ON llm_provider_connections(account_id, provider, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_provider_audit_account_created ON llm_provider_audit_events(account_id, created_at DESC);

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
