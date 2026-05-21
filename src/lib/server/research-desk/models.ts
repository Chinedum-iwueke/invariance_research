export const RESEARCH_DESK_SERVICES = [
  "execution_audit",
  "data_quality_audit",
  "benchmark_construction",
  "parameter_stability_review",
  "regime_context_review",
  "claim_validation",
  "investor_buyer_memo_review",
] as const;

export type ResearchDeskService = typeof RESEARCH_DESK_SERVICES[number];

export type LegacyResearchDeskService = "data_qa" | "benchmark_suite" | "claim_formalization" | "strategy_rewrite_hypothesis" | "full_advisory_validation";
export type ResearchDeskServiceInput = ResearchDeskService | LegacyResearchDeskService;

export const RESEARCH_DESK_SERVICE_ALIASES: Record<LegacyResearchDeskService, ResearchDeskService> = {
  data_qa: "data_quality_audit",
  benchmark_suite: "benchmark_construction",
  claim_formalization: "claim_validation",
  strategy_rewrite_hypothesis: "claim_validation",
  full_advisory_validation: "investor_buyer_memo_review",
};

export const RESEARCH_DESK_STATUSES = [
  "received",
  "scoped",
  "quoted",
  "in_review",
  "addendum_draft",
  "approved",
  "delivered",
  "closed",
] as const;

export type ResearchDeskRequestStatus = typeof RESEARCH_DESK_STATUSES[number];
export type LegacyResearchDeskRequestStatus = "new" | "triaged" | "addendum_approved";
export type ReviewerAddendumStatus = "draft" | "approved";
export type ResearchDeskTimelineEvent = {
  status: ResearchDeskRequestStatus;
  label: string;
  description: string;
  at?: string;
  state: "complete" | "current" | "pending";
};

export type ValidationPacketTemplate = {
  packet_version: "validation_packet_v2";
  analysis_id: string;
  artifact_id: string;
  report_snapshot_id: string;
  strategy_name: string;
  generated_at: string;
  trigger_limitation: string;
  requested_services: ResearchDeskService[];
  requested_questions: string[];
  client_note?: string;
  artifact_manifest: {
    artifact_id: string;
    file_name?: string;
    file_type?: string;
    file_size_bytes?: number;
    checksum_sha256?: string;
    artifact_kind?: string;
    richness?: string;
    uploaded_at?: string;
    eligibility_summary?: {
      accepted: boolean;
      detected_artifact_type?: string;
      detected_richness?: string;
      diagnostics_available: string[];
      diagnostics_limited: string[];
      diagnostics_unavailable: string[];
      limitation_reasons: string[];
    };
  };
  evidence_ledger: Array<{
    diagnostic: string;
    artifact_status: string;
    engine_status: string;
    final_status: string;
    display_status: string;
    artifact_reason?: string;
    engine_reason?: string;
    required_inputs: string[];
    optional_enrichments: string[];
  }>;
  assumption_ledger: Array<Record<string, unknown>>;
  unsupported_claims: Array<Record<string, unknown>>;
  diagnostic_outputs: Array<{
    diagnostic: string;
    status: string;
    reason?: string;
    metrics: Array<{ label: string; value: string; state?: string }>;
    limitations: string[];
    recommendations: string[];
  }>;
  limitations: string[];
  recommendations: string[];
  warnings: string[];
  decision_metrics: Array<{ label: string; value: string; state?: string }>;
  reviewer_checklist: string[];
};

export type ResearchDeskRequestRecord = {
  request_id: string;
  report_snapshot_id: string;
  analysis_id: string;
  artifact_id: string;
  account_id: string;
  requested_by_user_id: string;
  trigger_limitation: string;
  requested_services: ResearchDeskService[];
  validation_packet: ValidationPacketTemplate;
  status: ResearchDeskRequestStatus;
  user_note?: string;
  created_at: string;
  updated_at: string;
};

export type ReviewerAddendumRecord = {
  addendum_id: string;
  request_id: string;
  report_snapshot_id: string;
  analysis_id: string;
  reviewer_user_id: string;
  status: ReviewerAddendumStatus;
  internal_note?: string;
  public_addendum?: string;
  created_at: string;
  updated_at: string;
  approved_at?: string;
};

export type WedgeLearningEventRecord = {
  event_id: string;
  request_id: string;
  report_snapshot_id: string;
  analysis_id: string;
  account_id: string;
  event_type: "research_desk_request_created" | "reviewer_addendum_approved";
  learning_key: string;
  evidence_count: number;
  promotion_candidate: boolean;
  promoted_at?: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export function isResearchDeskService(value: string): value is ResearchDeskService {
  return RESEARCH_DESK_SERVICES.includes(value as ResearchDeskService);
}

export function canonicalResearchDeskService(value: string): ResearchDeskService | undefined {
  if (isResearchDeskService(value)) return value;
  return RESEARCH_DESK_SERVICE_ALIASES[value as LegacyResearchDeskService];
}

export function isResearchDeskRequestStatus(value: string): value is ResearchDeskRequestStatus {
  return RESEARCH_DESK_STATUSES.includes(value as ResearchDeskRequestStatus);
}

export function canonicalResearchDeskStatus(value: string): ResearchDeskRequestStatus | undefined {
  if (isResearchDeskRequestStatus(value)) return value;
  if (value === "new") return "received";
  if (value === "triaged") return "scoped";
  if (value === "addendum_approved") return "approved";
  return undefined;
}

export function isReviewerAddendumStatus(value: string): value is ReviewerAddendumStatus {
  return ["draft", "approved"].includes(value);
}
