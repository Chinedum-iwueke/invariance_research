export type ResearchMemoryType = "verdict" | "failure" | "next_experiment" | "run_quality" | "execution_drag" | "state_dependency" | "parameter_fragility" | "null_comparison";

export type ResearchMemoryItem = {
  memory_item_id: string;
  account_id: string;
  program_id: string;
  experiment_job_id?: string;
  memory_type: ResearchMemoryType;
  title: string;
  summary: string;
  status: string;
  confidence: number;
  source_event_id?: string;
  source_card_type?: string;
  source: Record<string, unknown>;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type ResearchMemoryLink = {
  memory_link_id: string;
  account_id: string;
  source_memory_item_id: string;
  target_type: "program" | "experiment_job" | "experiment_plan" | "card" | "artifact";
  target_id: string;
  relation: string;
  evidence: Record<string, unknown>;
  created_at: string;
};

export type ResearchFinding = {
  finding_id: string;
  account_id: string;
  program_id: string;
  memory_item_id?: string;
  finding_type: string;
  headline: string;
  detail: string;
  severity: "info" | "warning" | "critical";
  evidence: Record<string, unknown>;
  created_at: string;
};

export type ProgramRecommendation = {
  recommendation_id: string;
  account_id: string;
  program_id: string;
  experiment_job_id?: string;
  recommendation_type: string;
  recommendation: string;
  status: "proposed" | "accepted" | "dismissed" | "completed";
  confidence: number;
  evidence: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type SimilarRunIndexEntry = {
  similar_run_index_id: string;
  account_id: string;
  program_id: string;
  experiment_job_id?: string;
  signature: string;
  features: Record<string, unknown>;
  source_memory_item_id?: string;
  created_at: string;
};

export type ResearchMemorySnapshot = {
  items: ResearchMemoryItem[];
  findings: ResearchFinding[];
  recommendations: ProgramRecommendation[];
  similar_runs: SimilarRunIndexEntry[];
};
