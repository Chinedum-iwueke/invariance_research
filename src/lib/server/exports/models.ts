export type ExportFormat = "json" | "md" | "pdf";

export type ExportRecord = {
  export_id: string;
  analysis_id: string;
  account_id: string;
  requested_by_user_id: string;
  report_snapshot_id?: string;
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

export type ReportSnapshotStatus = "active" | "superseded";

export type ReportSnapshotPayload = {
  snapshot_id: string;
  analysis_id: string;
  generated_at: string;
  source_analysis_updated_at: string;
  source_result_checksum: string;
  record: import("@/lib/contracts").AnalysisRecord;
  report_view: ReturnType<typeof import("@/lib/app/report-view").buildReportViewModel>;
  decision_metrics: import("@/lib/contracts").ScoreBand[];
  evidence_ledger?: import("@/lib/server/evidence/evidence-ledger-service").EvidenceLedger;
  warnings: string[];
};

export type ReportSnapshotRecord = {
  snapshot_id: string;
  analysis_id: string;
  account_id: string;
  status: ReportSnapshotStatus;
  source_analysis_updated_at: string;
  source_result_checksum: string;
  payload: ReportSnapshotPayload;
  warning_count: number;
  created_at: string;
  superseded_at?: string;
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
