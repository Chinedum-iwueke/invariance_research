import type { AnalysisListItem } from "@/lib/contracts";

export type ResearchProgramStatus = "active" | "paused" | "archived";
export type ProgramMemberRole = "owner" | "editor" | "viewer";
export type ProgramEventType =
  | "program_created"
  | "analysis_attached"
  | "note_added"
  | "hypothesis_created"
  | "hypothesis_approved"
  | "strategy_spec_created"
  | "strategy_spec_approved"
  | "experiment_plan_created"
  | "experiment_plan_approved"
  | "experiment_queued"
  | "experiment_job_updated"
  | "run_completed"
  | "verdict_recorded"
  | "report_snapshot_created";

export type ResearchProgram = {
  program_id: string;
  account_id: string;
  owner_user_id: string;
  title: string;
  thesis: string;
  status: ResearchProgramStatus;
  market?: string;
  asset_universe?: string;
  timeframe?: string;
  next_action: string;
  created_at: string;
  updated_at: string;
  archived_at?: string;
};

export type ProgramMember = {
  program_id: string;
  account_id: string;
  user_id: string;
  role: ProgramMemberRole;
  created_at: string;
};

export type ProgramEvent = {
  event_id: string;
  program_id: string;
  account_id: string;
  actor_user_id?: string;
  event_type: ProgramEventType;
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export type ProgramArtifact = {
  program_artifact_id: string;
  program_id: string;
  account_id: string;
  artifact_id?: string;
  analysis_id?: string;
  artifact_role: "audit_import" | "engine_run" | "context" | "report_evidence";
  attached_by_user_id: string;
  created_at: string;
};

export type ProgramNote = {
  note_id: string;
  program_id: string;
  account_id: string;
  author_user_id: string;
  note_type: "research_note" | "decision" | "next_step";
  body: string;
  created_at: string;
  updated_at: string;
};

export type ProgramReportSnapshot = {
  program_report_snapshot_id: string;
  program_id: string;
  account_id: string;
  report_snapshot_id?: string;
  title: string;
  status: "draft" | "active" | "superseded";
  payload: Record<string, unknown>;
  created_at: string;
};

export type ResearchBriefIntakeFields = {
  market_intuition: string;
  asset_universe?: string;
  timeframe?: string;
  holding_period?: string;
  entry_idea?: string;
  exit_idea?: string;
  risk_assumption?: string;
  cost_slippage_assumption?: string;
  data_source?: string;
  disproof_condition?: string;
};

export type ClarificationQuestion = {
  question_id: string;
  field: keyof ResearchBriefIntakeFields | "market_mechanism" | "benchmark" | "constraints";
  question: string;
  why_it_matters: string;
  required: boolean;
};

export type MissingAssumption = {
  assumption_id: string;
  field: string;
  label: string;
  severity: "blocking" | "important" | "optional";
  why_it_matters: string;
};

export type ResearchBriefV1 = {
  schema_version: "research_brief_v1";
  program_id: string;
  title: string;
  thesis: string;
  market_intuition: string;
  asset_universe?: string;
  timeframe?: string;
  holding_period?: string;
  entry_idea?: string;
  exit_idea?: string;
  risk_assumption?: string;
  cost_slippage_assumption?: string;
  data_source?: string;
  disproof_condition?: string;
  missing_assumptions: MissingAssumption[];
  clarification_answers: Record<string, string>;
  readiness: "needs_clarification" | "ready_for_hypothesis_draft";
  created_at: string;
};

export type ProgramClarificationSession = {
  session_id: string;
  program_id: string;
  account_id: string;
  created_by_user_id: string;
  status: "draft" | "accepted";
  raw_intuition: string;
  intake_fields: ResearchBriefIntakeFields;
  assistant_questions: ClarificationQuestion[];
  missing_assumptions: MissingAssumption[];
  accepted_answers?: Record<string, string>;
  research_brief?: ResearchBriefV1;
  provider: string;
  model?: string;
  error_summary?: string;
  created_at: string;
  updated_at: string;
  accepted_at?: string;
};

export type ResearchBriefRecord = {
  brief_id: string;
  program_id: string;
  account_id: string;
  clarification_session_id?: string;
  version: number;
  status: "accepted";
  brief: ResearchBriefV1;
  created_by_user_id: string;
  created_at: string;
  accepted_at: string;
};

export type HypothesisApprovalState = "draft" | "needs_clarification" | "approved_for_strategy_generation" | "retired";
export type StrategySpecApprovalState = "draft" | "needs_revision" | "approved_for_execution" | "retired";

export type ParameterRange = {
  min: number;
  max: number;
  default: number;
};

export type HypothesisSpecV1 = {
  schema_version: "hypothesis_spec_v1";
  hypothesis_id: string;
  title: string;
  thesis: string;
  market_mechanism: string;
  observable_features: string[];
  entry_condition_intent: string;
  exit_condition_intent: string;
  invalidation_criteria: string[];
  required_datasets: string[];
  cost_model_assumptions: string;
  benchmark_or_null: string;
  expected_failure_modes: string[];
  safe_parameter_ranges: Record<string, ParameterRange>;
  out_of_sample_plan: string;
  execution_semantics: Record<string, unknown>;
  source_brief_id?: string;
  generated_by: "deterministic_assistant" | "llm_assistant" | "user";
  generated_at: string;
};

export type StrategySpecV1 = {
  schema_version: "strategy_spec_v1";
  strategy_spec_id: string;
  hypothesis_id: string;
  hypothesis_version_id: string;
  strategy_family: "trend_continuation" | "mean_reversion" | "breakout" | "volatility_filter" | "funding_liquidation_context";
  universe: string[];
  timeframe: string;
  required_datasets: string[];
  signals: Array<Record<string, unknown>>;
  parameters: Record<string, ParameterRange>;
  cost_model: Record<string, unknown>;
  slippage_model: Record<string, unknown>;
  risk_model: Record<string, unknown>;
  execution_semantics: Record<string, unknown>;
  compiler: Record<string, unknown>;
  assistant_assumptions: string[];
  user_approval_required: true;
  generated_by: "deterministic_assistant" | "llm_assistant" | "user";
  generated_at: string;
};

export type HypothesisRecord = {
  hypothesis_id: string;
  program_id: string;
  account_id: string;
  title: string;
  status: HypothesisApprovalState;
  active_version_id?: string;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
};

export type HypothesisVersionRecord = {
  hypothesis_version_id: string;
  hypothesis_id: string;
  program_id: string;
  account_id: string;
  version: number;
  status: HypothesisApprovalState;
  source_brief_id?: string;
  spec: HypothesisSpecV1;
  validation_errors: string[];
  created_by_user_id: string;
  created_at: string;
  approved_at?: string;
  approved_by_user_id?: string;
};

export type HypothesisApprovalRecord = {
  approval_id: string;
  hypothesis_version_id: string;
  hypothesis_id: string;
  program_id: string;
  account_id: string;
  actor_user_id: string;
  from_status?: HypothesisApprovalState;
  to_status: HypothesisApprovalState;
  note?: string;
  created_at: string;
};

export type StrategySpecRecord = {
  strategy_spec_record_id: string;
  program_id: string;
  account_id: string;
  hypothesis_version_id: string;
  version: number;
  status: StrategySpecApprovalState;
  spec: StrategySpecV1;
  validation_errors: string[];
  created_by_user_id: string;
  created_at: string;
  approved_at?: string;
  approved_by_user_id?: string;
};

export type ExperimentPlanStatus = "draft" | "approved" | "queued" | "retired";
export type ExperimentItemStatus = "draft" | "queued" | "disabled";
export type ExperimentJobStatus = "queued" | "paused" | "processing" | "completed" | "failed" | "canceled";

export type ExperimentPlanItemV1 = {
  item_id: string;
  experiment_type: "baseline" | "cost_sensitivity" | "slippage_sensitivity" | "parameter_grid" | "holdout_split" | "benchmark_null" | "regime_state_split" | "alternative_exit";
  title: string;
  priority: number;
  enabled: boolean;
  required_datasets: string[];
  runtime_budget: {
    max_minutes: number;
    max_variants: number;
  };
  config_patch: Record<string, unknown>;
  falsification_question: string;
};

export type ExperimentPlanV1 = {
  schema_version: "experiment_plan_v1";
  plan_id: string;
  strategy_spec_id: string;
  hypothesis_id: string;
  plan_title: string;
  status: ExperimentPlanStatus;
  items: ExperimentPlanItemV1[];
  limits: {
    max_concurrent: number;
    max_queued_items: number;
    estimated_compute_units: number;
  };
  approval_required: true;
};

export type ExperimentPlanRecord = {
  experiment_plan_id: string;
  program_id: string;
  account_id: string;
  strategy_spec_record_id: string;
  hypothesis_version_id: string;
  status: ExperimentPlanStatus;
  plan: ExperimentPlanV1;
  validation_errors: string[];
  created_by_user_id: string;
  created_at: string;
  approved_at?: string;
  approved_by_user_id?: string;
  queued_at?: string;
};

export type ExperimentPlanItemRecord = {
  experiment_plan_item_id: string;
  experiment_plan_id: string;
  program_id: string;
  account_id: string;
  item_key: string;
  experiment_type: ExperimentPlanItemV1["experiment_type"];
  title: string;
  status: ExperimentItemStatus;
  priority: number;
  required_datasets: string[];
  runtime_budget: ExperimentPlanItemV1["runtime_budget"];
  config_patch: Record<string, unknown>;
  falsification_question: string;
  created_at: string;
  queued_at?: string;
};

export type ExperimentJobRecord = {
  experiment_job_id: string;
  experiment_plan_item_id: string;
  experiment_plan_id: string;
  program_id: string;
  account_id: string;
  status: ExperimentJobStatus;
  priority: number;
  progress_pct: number;
  current_step: string;
  retry_count: number;
  max_attempts: number;
  available_at: string;
  leased_until?: string;
  last_error?: string;
  created_at: string;
  updated_at: string;
  started_at?: string;
  finished_at?: string;
};

export type ExperimentJobEventRecord = {
  experiment_job_event_id: string;
  experiment_job_id: string;
  experiment_plan_id: string;
  program_id: string;
  account_id: string;
  event_type: "queued" | "paused" | "canceled" | "retried" | "priority_changed" | "lease_expired" | "worker_note";
  message: string;
  payload: Record<string, unknown>;
  actor_user_id?: string;
  created_at: string;
};

export type ProgramSummary = ResearchProgram & {
  attached_analysis_count: number;
  completed_analysis_count: number;
  failed_analysis_count: number;
  active_hypothesis_count: number;
  promoted_count: number;
  last_run_at?: string;
};

export type ProgramDetail = {
  program: ProgramSummary;
  events: ProgramEvent[];
  notes: ProgramNote[];
  artifacts: ProgramArtifact[];
  analyses: AnalysisListItem[];
  clarification_sessions: ProgramClarificationSession[];
  research_briefs: ResearchBriefRecord[];
  hypotheses: HypothesisRecord[];
  hypothesis_versions: HypothesisVersionRecord[];
  strategy_specs: StrategySpecRecord[];
  experiment_plans: ExperimentPlanRecord[];
  experiment_plan_items: ExperimentPlanItemRecord[];
  experiment_jobs: ExperimentJobRecord[];
};

export type CreateProgramInput = {
  account_id: string;
  owner_user_id: string;
  title: string;
  thesis: string;
  market?: string;
  asset_universe?: string;
  timeframe?: string;
};
