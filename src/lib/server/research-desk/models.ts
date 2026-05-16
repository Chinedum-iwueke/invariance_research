export const RESEARCH_DESK_SERVICES = [
  "execution_audit",
  "data_qa",
  "benchmark_suite",
  "claim_formalization",
  "strategy_rewrite_hypothesis",
  "full_advisory_validation",
] as const;

export type ResearchDeskService = typeof RESEARCH_DESK_SERVICES[number];

export type ResearchDeskRequestStatus = "new" | "triaged" | "in_review" | "addendum_approved" | "closed";
export type ReviewerAddendumStatus = "draft" | "approved";

export type ValidationPacketTemplate = {
  packet_version: "validation_packet_v1";
  analysis_id: string;
  artifact_id: string;
  report_snapshot_id: string;
  strategy_name: string;
  generated_at: string;
  trigger_limitation: string;
  requested_services: ResearchDeskService[];
  limitations: string[];
  recommendations: string[];
  warnings: string[];
  decision_metrics: Array<{ label: string; value: string; state?: string }>;
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

export function isResearchDeskRequestStatus(value: string): value is ResearchDeskRequestStatus {
  return ["new", "triaged", "in_review", "addendum_approved", "closed"].includes(value);
}

export function isReviewerAddendumStatus(value: string): value is ReviewerAddendumStatus {
  return ["draft", "approved"].includes(value);
}
