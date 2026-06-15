import type { PlanId } from "@/lib/contracts/account";

export type ArtifactUploadClass = "trade_csv" | "structured_bundle" | "research_bundle";

export interface EntitlementSnapshot {
  account_id: string;
  plan_id: PlanId;
  analyses_per_month: number;
  max_upload_file_size_mb: number;
  can_upload_trade_csv: boolean;
  can_upload_bundle: boolean;
  can_upload_research_bundle: boolean;
  can_view_overview: boolean;
  can_view_distribution: boolean;
  can_view_monte_carlo: boolean;
  can_view_ruin: boolean;
  can_view_prop_evaluation: boolean;
  can_view_execution: boolean;
  can_view_regimes: boolean;
  can_view_stability: boolean;
  can_view_full_report: boolean;
  can_export_report: boolean;
  can_create_share_links: boolean;
  share_links_per_month: number;
  can_request_research_desk: boolean;
  max_seats: number;
  programs_limit: number;
  active_hypotheses_limit: number;
  queued_experiments_limit: number;
  concurrent_experiments_limit: number;
  monthly_experiment_compute_units: number;
  monthly_assistant_calls: number;
  prop_evaluation_profiles: number | "shared" | "unlimited";
  history_retention_days: number;
  memory_retention_days: number;
  processing_priority: "standard" | "priority" | "premium" | "institutional";
  consulting_cta_variant: "soft" | "serious" | "institutional";
  effective_at: string;
  source_of_truth: "plan_matrix" | "stripe_webhook" | "admin_override";
}

export interface UsageSnapshot {
  account_id: string;
  month_bucket: string;
  analyses_created: number;
  artifacts_uploaded: number;
  report_exports: number;
  programs_created: number;
  hypotheses_created: number;
  experiments_queued: number;
  experiment_compute_units: number;
  assistant_calls: number;
  share_links_created: number;
  research_desk_requests: number;
}

export type DiagnosticAccessReason = "artifact_unavailable" | "engine_unavailable" | "plan_locked" | "enabled";
