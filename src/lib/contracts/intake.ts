import type { AnalysisRecord, AnalysisStatus } from "@/lib/contracts/analysis";
import type { BenchmarkId } from "@/lib/benchmarks/benchmark-ids";
import type {
  ArtifactKind,
  ArtifactRichness,
  ArtifactValidationError,
  BundleArtifactType,
  DiagnosticName,
  UploadEligibilitySummary,
} from "@/lib/server/ingestion";

export type JobStatus = "queued" | "processing" | "completed" | "failed";

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
};

export type CreateAnalysisRequest = {
  artifact_id: string;
  strategy_name?: string;
  benchmark?: {
    mode: "auto" | "none" | "manual";
    requested_id: BenchmarkId | null;
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
