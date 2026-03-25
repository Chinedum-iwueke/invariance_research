import type { AnalysisEntity } from "@/lib/server/analysis/models";
import type { ParsedArtifact, UploadEligibilitySummary } from "@/lib/server/ingestion";

export type EngineDiagnosticStatus = "available" | "limited" | "unavailable" | "skipped";

export type EngineCapabilityProfile = Partial<Record<
  "overview" | "distribution" | "monte_carlo" | "stability" | "execution" | "regimes" | "ruin" | "report",
  { status: EngineDiagnosticStatus; reason?: string }
>>;

export type EngineRunContext = {
  engine_name: string;
  engine_version?: string;
  seam: "run_analysis_from_parsed_artifact";
  degraded: boolean;
  degradation_reasons: string[];
};

export type EngineAnalysisResult = {
  status: "completed" | "failed";
  summary?: {
    robustness_score?: number;
    overfitting_risk_pct?: number;
    verdict?: "robust" | "moderate" | "fragile";
    short_summary?: string;
    key_findings?: string[];
    warnings?: Array<{ code: string; message: string; severity?: "info" | "warning" | "critical" }>;
  };
  diagnostics?: Record<string, unknown>;
  report?: {
    executive_summary?: string;
    methodology_assumptions?: string[];
    recommendations?: string[];
    export_ready?: boolean;
  };
  capability_profile?: EngineCapabilityProfile;
  skipped_diagnostics?: Array<{ diagnostic: string; reason: string }>;
  run_context?: Partial<Pick<EngineRunContext, "engine_version">>;
};

export type RunBulletproofAnalysisParams = {
  analysis: AnalysisEntity;
  parsedArtifact: ParsedArtifact;
  eligibility: UploadEligibilitySummary;
};

export type BulletproofRunResponse = {
  result: EngineAnalysisResult;
  context: EngineRunContext;
};
