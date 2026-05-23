import type { LaunchPlanId, LegacyPlanId, PlanId } from "@/lib/contracts/account";
import type { EntitlementSnapshot } from "@/lib/contracts/entitlements";

type EntitlementTemplate = Omit<EntitlementSnapshot, "account_id" | "effective_at" | "source_of_truth">;

export const LAUNCH_PLAN_IDS = ["free", "individual", "pro", "team", "research_desk"] as const satisfies readonly LaunchPlanId[];

export const LEGACY_PLAN_ALIASES: Record<LegacyPlanId, LaunchPlanId> = {
  explorer: "free",
  professional: "individual",
  research_lab: "pro",
  advisory: "research_desk",
};

export const PLAN_LABELS: Record<LaunchPlanId, string> = {
  free: "Free",
  individual: "Individual",
  pro: "Pro",
  team: "Team",
  research_desk: "Research Desk",
};

export const PLAN_PRICE_COPY: Record<LaunchPlanId, string> = {
  free: "$0",
  individual: "$39/mo",
  pro: "$99/mo",
  team: "$399/mo",
  research_desk: "From $1,000",
};

export function canonicalPlanId(planId: PlanId | string | undefined): LaunchPlanId {
  if (planId === "free" || planId === "individual" || planId === "pro" || planId === "team" || planId === "research_desk") return planId;
  if (planId === "explorer" || planId === "professional" || planId === "research_lab" || planId === "advisory") return LEGACY_PLAN_ALIASES[planId];
  return "free";
}

const launchPlans: Record<LaunchPlanId, EntitlementTemplate> = {
  free: {
    plan_id: "free",
    analyses_per_month: 3,
    max_upload_file_size_mb: 10,
    can_upload_trade_csv: true,
    can_upload_bundle: false,
    can_upload_research_bundle: false,
    can_view_overview: true,
    can_view_distribution: true,
    can_view_monte_carlo: true,
    can_view_ruin: true,
    can_view_prop_evaluation: true,
    can_view_execution: false,
    can_view_regimes: false,
    can_view_stability: false,
    can_view_full_report: false,
    can_export_report: false,
    can_create_share_links: false,
    share_links_per_month: 0,
    can_request_research_desk: false,
    max_seats: 1,
    prop_evaluation_profiles: 0,
    history_retention_days: 30,
    processing_priority: "standard",
    consulting_cta_variant: "soft",
  },
  individual: {
    plan_id: "individual",
    analyses_per_month: 25,
    max_upload_file_size_mb: 25,
    can_upload_trade_csv: true,
    can_upload_bundle: true,
    can_upload_research_bundle: false,
    can_view_overview: true,
    can_view_distribution: true,
    can_view_monte_carlo: true,
    can_view_ruin: true,
    can_view_prop_evaluation: true,
    can_view_execution: true,
    can_view_regimes: false,
    can_view_stability: false,
    can_view_full_report: true,
    can_export_report: true,
    can_create_share_links: true,
    share_links_per_month: 5,
    can_request_research_desk: false,
    max_seats: 1,
    prop_evaluation_profiles: 1,
    history_retention_days: 365,
    processing_priority: "priority",
    consulting_cta_variant: "serious",
  },
  pro: {
    plan_id: "pro",
    analyses_per_month: 100,
    max_upload_file_size_mb: 50,
    can_upload_trade_csv: true,
    can_upload_bundle: true,
    can_upload_research_bundle: true,
    can_view_overview: true,
    can_view_distribution: true,
    can_view_monte_carlo: true,
    can_view_ruin: true,
    can_view_prop_evaluation: true,
    can_view_execution: true,
    can_view_regimes: true,
    can_view_stability: true,
    can_view_full_report: true,
    can_export_report: true,
    can_create_share_links: true,
    share_links_per_month: 25,
    can_request_research_desk: true,
    max_seats: 1,
    prop_evaluation_profiles: "unlimited",
    history_retention_days: 730,
    processing_priority: "premium",
    consulting_cta_variant: "institutional",
  },
  team: {
    plan_id: "team",
    analyses_per_month: 250,
    max_upload_file_size_mb: 100,
    can_upload_trade_csv: true,
    can_upload_bundle: true,
    can_upload_research_bundle: true,
    can_view_overview: true,
    can_view_distribution: true,
    can_view_monte_carlo: true,
    can_view_ruin: true,
    can_view_prop_evaluation: true,
    can_view_execution: true,
    can_view_regimes: true,
    can_view_stability: true,
    can_view_full_report: true,
    can_export_report: true,
    can_create_share_links: true,
    share_links_per_month: 75,
    can_request_research_desk: true,
    max_seats: 5,
    prop_evaluation_profiles: "shared",
    history_retention_days: 1095,
    processing_priority: "institutional",
    consulting_cta_variant: "institutional",
  },
  research_desk: {
    plan_id: "research_desk",
    analyses_per_month: 250,
    max_upload_file_size_mb: 250,
    can_upload_trade_csv: true,
    can_upload_bundle: true,
    can_upload_research_bundle: true,
    can_view_overview: true,
    can_view_distribution: true,
    can_view_monte_carlo: true,
    can_view_ruin: true,
    can_view_prop_evaluation: true,
    can_view_execution: true,
    can_view_regimes: true,
    can_view_stability: true,
    can_view_full_report: true,
    can_export_report: true,
    can_create_share_links: true,
    share_links_per_month: 75,
    can_request_research_desk: true,
    max_seats: 10,
    prop_evaluation_profiles: "shared",
    history_retention_days: 1825,
    processing_priority: "institutional",
    consulting_cta_variant: "institutional",
  },
};

function aliasTemplate(alias: LegacyPlanId): EntitlementTemplate {
  const canonical = launchPlans[LEGACY_PLAN_ALIASES[alias]];
  return { ...canonical, plan_id: alias };
}

export const PLAN_MATRIX: Record<PlanId, EntitlementTemplate> = {
  ...launchPlans,
  explorer: aliasTemplate("explorer"),
  professional: aliasTemplate("professional"),
  research_lab: aliasTemplate("research_lab"),
  advisory: aliasTemplate("advisory"),
};
