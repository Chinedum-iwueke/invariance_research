export type ProvenanceState = "stated" | "extracted" | "inferred" | "recommended" | "confirmed" | "unresolved" | "unsupported";
export type CompileStatus = "registry_ready" | "graph_compilable" | "implementation_required" | "data_blocked" | "semantics_blocked" | "unsupported";

export type HypothesisCardV1 = {
  schema_version: "hypothesis_card_v1";
  card_id: string;
  program_id: string;
  version: number;
  status: "draft" | "confirmed" | "superseded";
  title: string;
  claim: string;
  intuition: string;
  market_mechanism: string;
  engine_strategy_name?: string;
  engine_hypothesis_template?: string;
  features: Array<Record<string, unknown> & { id: string; source: string; transform: string; lag?: number; join?: string }>;
  gates: Array<Record<string, unknown> & { op: string }>;
  entry: Record<string, unknown>;
  exit: Record<string, unknown>;
  sizing: Record<string, unknown>;
  risk_controls: Record<string, unknown>;
  parameters: Record<string, unknown[]>;
  data_requirements: string[];
  logging_requirements: string[];
  evaluation: Record<string, unknown>;
  falsification_criteria: string[];
  expected_failure_modes: string[];
  execution_semantics: Record<string, unknown>;
  source_citations: Array<Record<string, unknown>>;
  field_provenance: Record<string, { state: ProvenanceState; confidence: number; source_ids?: string[] }>;
  confirmed_by?: string;
  confirmed_at?: string;
  prompt_version: string;
};

export type HypothesisCardRecord = {
  card_record_id: string;
  card_id: string;
  program_id: string;
  account_id: string;
  source_proposal_id?: string;
  version: number;
  status: HypothesisCardV1["status"];
  card: HypothesisCardV1;
  card_hash: string;
  validation_errors: string[];
  created_by_user_id: string;
  created_at: string;
  confirmed_at?: string;
  confirmed_by_user_id?: string;
};

export type CompileReadinessReport = {
  schema_version: "compile_readiness_report_v1";
  strategy_spec_id: string;
  status: CompileStatus;
  blockers: Array<{ code: string; detail: string }>;
  capabilities: Record<string, boolean>;
  compiler_version: string;
  source_card_hash: string;
};

export type ResearchSpecBundleRecord = {
  spec_bundle_id: string;
  program_id: string;
  account_id: string;
  card_record_id: string;
  version: number;
  status: "generated" | "approved" | "superseded";
  bundle: Record<string, unknown> & { compile_readiness: CompileReadinessReport };
  bundle_hash: string;
  compile_status: CompileStatus;
  compiler_version: string;
  validation_errors: string[];
  generated_by_user_id: string;
  generated_at: string;
  approved_at?: string;
  approved_by_user_id?: string;
};

export type StrategyImplementationTaskRecord = {
  task_id: string;
  program_id: string;
  account_id: string;
  spec_bundle_id: string;
  status: "draft" | "in_review" | "approved" | "rejected" | "completed";
  task: Record<string, unknown>;
  evidence: Record<string, unknown>;
  created_at: string;
};

export type ResearchSpecBridgeDetail = {
  cards: HypothesisCardRecord[];
  bundles: ResearchSpecBundleRecord[];
  implementation_tasks: StrategyImplementationTaskRecord[];
};
