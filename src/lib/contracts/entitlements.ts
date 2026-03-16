import type { PlanId } from "@/lib/contracts/account";

export type ArtifactUploadClass = "trade_csv" | "structured_bundle" | "research_bundle";

export interface EntitlementSnapshot {
  account_id: string;
  plan_id: PlanId;
  analyses_per_month: number;
  can_upload_trade_csv: boolean;
  can_upload_bundle: boolean;
  can_upload_research_bundle: boolean;
  can_view_overview: boolean;
  can_view_distribution: boolean;
  can_view_monte_carlo: boolean;
  can_view_ruin: boolean;
  can_view_execution: boolean;
  can_view_regimes: boolean;
  can_view_stability: boolean;
  can_view_full_report: boolean;
  can_export_report: boolean;
  history_retention_days: number;
  processing_priority: "standard" | "priority" | "premium";
  consulting_cta_variant: "soft" | "serious" | "institutional";
  effective_at: string;
  source_of_truth: "plan_matrix" | "stripe_webhook";
}

export interface UsageSnapshot {
  account_id: string;
  month_bucket: string;
  analyses_created: number;
  artifacts_uploaded: number;
  report_exports: number;
}

export type DiagnosticAccessReason = "artifact_unavailable" | "engine_unavailable" | "plan_locked" | "enabled";
