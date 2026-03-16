import type { AnalysisRecord, AnalysisStatus } from "@/lib/contracts";
import type { ArtifactKind, ArtifactRichness, ParsedArtifact, UploadEligibilitySummary } from "@/lib/server/ingestion";

export type UploadArtifact = {
  artifact_id: string;
  owner_user_id: string;
  account_id: string;
  analysis_id?: string;
  file_name: string;
  file_type: string;
  file_size_bytes: number;
  storage_key: string;
  artifact_kind: ArtifactKind;
  richness: ArtifactRichness;
  uploaded_at: string;
  parsed_artifact: ParsedArtifact;
  eligibility_summary: UploadEligibilitySummary;
};

export type AnalysisEngineContext = {
  engine_name: string;
  engine_version?: string;
  seam?: string;
  degraded?: boolean;
  degradation_reasons?: string[];
};

export type AnalysisEntity = {
  analysis_id: string;
  owner_user_id: string;
  account_id: string;
  status: AnalysisStatus;
  strategy_name?: string;
  artifact_id: string;
  created_at: string;
  updated_at: string;
  result?: AnalysisRecord;
  eligibility_snapshot?: UploadEligibilitySummary;
  engine_context?: AnalysisEngineContext;
  failure_code?: string;
  failure_message?: string;
};

export type AnalysisJob = {
  job_id: string;
  analysis_id: string;
  job_type: "analysis_v1";
  status: "queued" | "processing" | "completed" | "failed";
  progress_pct?: number;
  current_step?: string;
  error_code?: string;
  error_message?: string;
  created_at: string;
  started_at?: string;
  finished_at?: string;
  retry_count: number;
};
