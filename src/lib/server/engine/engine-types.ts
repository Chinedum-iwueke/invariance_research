import type { AnalysisEntity } from "@/lib/server/analysis/models";
import type { ParsedArtifact, UploadEligibilitySummary } from "@/lib/server/ingestion";

export type EngineDiagnosticStatus = "supported" | "available" | "limited" | "unavailable" | "skipped";

export const ENGINE_SEAM_NAME = "run_analysis_from_parsed_artifact" as const;
export const ENGINE_SEAM_VERSION = "1.0.0" as const;
export const ENGINE_ADAPTER_VERSION = "1.0.0" as const;
export const ENGINE_PARSER_VERSION = "1.0.0" as const;
export const CAPABILITY_PROFILE_VERSION = "1.0.0" as const;
export const DIAGNOSTIC_CONTRACT_VERSION = "1.0.0" as const;

export type EngineEnvelopeV1 = {
  engine_name: string;
  engine_version?: string | null;
  strategy_truth_room_contract_version?: string;
  seam_name: typeof ENGINE_SEAM_NAME;
  seam_version: string;
  adapter_version: string;
  parser_version: string;
  capability_profile_version: string;
  diagnostic_contract_version: string;
};

export type EngineCapabilityProfile = Partial<Record<
  "overview" | "distribution" | "monte_carlo" | "stability" | "execution" | "regimes" | "ruin" | "prop_evaluation_readiness" | "report",
  { status: EngineDiagnosticStatus; reason?: string; required_inputs?: string[]; optional_enrichments?: string[] }
>>;

export type EngineRunContext = {
  engine_name: string;
  engine_version?: string;
  seam: typeof ENGINE_SEAM_NAME;
  seam_name: typeof ENGINE_SEAM_NAME;
  seam_version: string;
  adapter_version: string;
  parser_version: string;
  capability_profile_version: string;
  diagnostic_contract_version: string;
  benchmark_config?: Record<string, unknown>;
  account_size?: number;
  risk_per_trade_pct?: number;
  prop_evaluation_rules?: Record<string, unknown>;
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
  envelope?: EngineEnvelopeV1;
  capability_profile?: EngineCapabilityProfile;
  evidence_facts?: Record<string, unknown>[];
  assumption_ledger?: Record<string, unknown>[];
  claim_inventory?: Record<string, unknown>[];
  proof_report?: Record<string, unknown>;
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
