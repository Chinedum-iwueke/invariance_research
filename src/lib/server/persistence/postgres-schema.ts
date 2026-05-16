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
  PRIMARY KEY (account_id, month_bucket)
);

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

CREATE INDEX IF NOT EXISTS idx_export_jobs_status_available_at ON export_jobs(status, available_at);
CREATE INDEX IF NOT EXISTS idx_exports_account_analysis ON exports(account_id, analysis_id);

CREATE TABLE IF NOT EXISTS report_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  analysis_id TEXT NOT NULL REFERENCES analyses(analysis_id),
  account_id TEXT NOT NULL REFERENCES accounts(account_id),
  status TEXT NOT NULL,
  source_analysis_updated_at TIMESTAMPTZ NOT NULL,
  source_result_checksum TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  warning_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  superseded_at TIMESTAMPTZ
);

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
