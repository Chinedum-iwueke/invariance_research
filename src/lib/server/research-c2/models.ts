export type QualificationRecord = {
  qualification_id: string;
  program_id: string;
  account_id: string;
  spec_bundle_id: string;
  experiment_job_id?: string;
  status: "blocked" | "qualified";
  strategy_spec_hash: string;
  risk_policy_hash: string;
  config_hash: string;
  snapshot_hash: string;
  snapshot: Record<string, unknown>;
  created_by_user_id: string;
  created_at: string;
  approved_at?: string;
  approved_by_user_id?: string;
};
export type CatalogEntry = {
  schema_version: "program_artifact_catalog_entry_v1";
  catalog_hash: string;
  catalog_id: string;
  account_id: string;
  program_id: string;
  artifact_type:
    | "manifest"
    | "run_config"
    | "dataset"
    | "trades"
    | "metrics"
    | "verdict_card"
    | "log"
    | "report"
    | "incident"
    | "spec"
    | "memory";
  object_id: string;
  sensitivity: "public" | "account_private" | "program_private" | "secret";
  content_hash: string;
  lineage: Record<string, unknown>;
  summary: string;
  searchable_text: string;
  anchors: Array<Record<string, unknown>>;
  schema: Record<string, unknown>;
  query_payload: Record<string, unknown>;
  units: Record<string, string>;
  storage_key?: string;
  status: "ready" | "unsupported";
  created_at: string;
  updated_at: string;
};
export type PineExportRecord = {
  pine_export_id: string;
  account_id: string;
  program_id: string;
  spec_bundle_id: string;
  status: "ready" | "superseded" | "failed";
  compatibility_status: string;
  parity_status: string;
  bundle_hash: string;
  storage_prefix: string;
  manifest: Record<string, unknown>;
  created_by_user_id: string;
  created_at: string;
  superseded_at?: string;
};
export type PineExportJobRecord = {
  pine_export_job_id: string;
  pine_export_id: string;
  account_id: string;
  program_id: string;
  spec_bundle_id: string;
  status: "queued" | "running" | "ready" | "failed";
  progress_pct: number;
  error_code?: string;
  created_by_user_id: string;
  created_at: string;
  started_at?: string;
  finished_at?: string;
};
export type C2ProgramDetail = {
  qualifications: QualificationRecord[];
  catalog: CatalogEntry[];
  pine_exports: PineExportRecord[];
  pine_export_jobs: PineExportJobRecord[];
  pine_imports: Array<Record<string, unknown>>;
  parity_results: Array<Record<string, unknown>>;
  alert_credentials: Array<{
    credential_id: string;
    pine_export_id: string;
    status: string;
    expires_at?: string;
    created_at: string;
  }>;
  observations: Array<Record<string, unknown>>;
};
