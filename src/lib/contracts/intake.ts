import type { AnalysisRecord, AnalysisStatus } from "@/lib/contracts/analysis";
import type { BenchmarkId } from "@/lib/benchmarks/benchmark-ids";
import type { EvidenceLedger } from "@/lib/server/evidence/evidence-ledger-service";
import type {
  ArtifactKind,
  ArtifactRichness,
  ArtifactValidationError,
  BundleArtifactType,
  DiagnosticName,
  UploadEligibilitySummary,
} from "@/lib/server/ingestion";

export type JobStatus = "queued" | "processing" | "running" | "completed" | "failed" | "dead_letter";

export type CsvUploadPreview = {
  columns: string[];
  rows: string[][];
  row_count_shown: number;
  row_count_total: number;
};

export type ZipIngestionEntry = {
  path: string;
  file_type: string;
  status: "recognized" | "ignored" | "unsupported";
  role?: string;
  schema_version?: string;
  required?: boolean;
  note?: string;
};

export type ZipUploadReview = {
  recognized_count: number;
  ignored_count: number;
  unsupported_count: number;
  manifest_type?: string;
  contract_version?: string;
  diagnostic_unlocks?: {
    available: DiagnosticName[];
    limited: DiagnosticName[];
    unavailable: DiagnosticName[];
  };
  entries: ZipIngestionEntry[];
};

export type UploadReview =
  | {
      kind: "csv";
      csv_preview: CsvUploadPreview;
    }
  | {
      kind: "zip";
      zip_review: ZipUploadReview;
    };

export type UploadInspectionResponse = {
  artifact_id?: string;
  artifact_kind?: ArtifactKind;
  artifact_type?: BundleArtifactType | "trade_csv";
  artifact_richness?: ArtifactRichness;
  accepted: boolean;
  parser_notes: string[];
  validation_errors: ArtifactValidationError[];
  diagnostics_available: DiagnosticName[];
  diagnostics_limited: DiagnosticName[];
  diagnostics_unavailable: DiagnosticName[];
  limitation_reasons: string[];
  upload_summary_text: string;
  evidence_ledger?: EvidenceLedger;
  upload_review?: UploadReview;
};

export type CreateAnalysisRequest = {
  artifact_id: string;
  strategy_name?: string;
  benchmark?: {
    mode: "auto" | "none" | "manual";
    requested_id: BenchmarkId | null;
  };
  runtime_config?: {
    account_size?: number;
    risk_per_trade_pct?: number;
    prop_evaluation_rules?: Record<string, unknown>;
  };
};

export type CreateAnalysisResponse = {
  analysis_id: string;
  status: AnalysisStatus;
  job: {
    job_id: string;
    status: JobStatus;
  };
  artifact_summary: Pick<UploadEligibilitySummary, "detected_artifact_type" | "detected_richness">;
  next_urls: {
    status: string;
    overview: string;
  };
};

export type AnalysisStatusResponse = {
  analysis_id: string;
  status: AnalysisStatus;
  job_status: JobStatus;
  current_step?: string;
  progress_pct?: number;
  message: string;
  error?: { code: string; message: string };
};

export type AnalysisListItem = {
  analysis_id: string;
  strategy_name: string;
  trade_count: number;
  timeframe: string;
  asset: string;
  created_at: string;
  status: AnalysisStatus;
  robustness_score: string;
};

export type AnalysisListResponse = {
  items: AnalysisListItem[];
};

export type AnalysisDetailResponse = {
  analysis_id: string;
  status: AnalysisStatus;
  record?: AnalysisRecord;
  error?: { code: string; message: string };
};
