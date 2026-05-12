export const postgresSchemaSql = `
CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  last_login_at TIMESTAMPTZ NOT NULL,
  password_hash TEXT,
  password_updated_at TIMESTAMPTZ
);

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
