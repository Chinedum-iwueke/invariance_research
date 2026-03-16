export type ExportFormat = "json" | "md" | "pdf";

export type ExportRecord = {
  export_id: string;
  analysis_id: string;
  account_id: string;
  requested_by_user_id: string;
  format: ExportFormat;
  status: "queued" | "processing" | "completed" | "failed";
  storage_key?: string;
  content_type?: string;
  file_size_bytes?: number;
  checksum_sha256?: string;
  error_code?: string;
  error_message?: string;
  requested_at: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
};

export type ExportJob = {
  export_job_id: string;
  export_id: string;
  analysis_id: string;
  account_id: string;
  format: ExportFormat;
  status: "queued" | "processing" | "completed" | "failed";
  progress_pct?: number;
  current_step?: string;
  error_code?: string;
  error_message?: string;
  retry_count: number;
  created_at: string;
  started_at?: string;
  finished_at?: string;
  available_at?: string;
  last_attempt_at?: string;
};
