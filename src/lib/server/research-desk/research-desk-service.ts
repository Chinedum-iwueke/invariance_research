import { randomUUID } from "node:crypto";
import { ensureReportSnapshotForAnalysis } from "@/lib/server/exports/report-snapshot-service";
import { getCoreRepositories } from "@/lib/server/persistence/repositories";
import { researchDeskRepository } from "@/lib/server/repositories/research-desk-repository";
import {
  isResearchDeskRequestStatus,
  isResearchDeskService,
  isReviewerAddendumStatus,
  type ResearchDeskRequestRecord,
  type ResearchDeskRequestStatus,
  type ResearchDeskService,
  type ReviewerAddendumRecord,
  type ReviewerAddendumStatus,
  type ValidationPacketTemplate,
  type WedgeLearningEventRecord,
} from "@/lib/server/research-desk/models";

const DEFAULT_SERVICES: ResearchDeskService[] = ["execution_audit", "data_qa", "benchmark_suite"];
const PROMOTION_EVIDENCE_THRESHOLD = 3;

export async function createResearchDeskRequest(input: {
  analysis_id: string;
  account_id: string;
  requested_by_user_id: string;
  trigger_limitation?: string;
  requested_services?: string[];
  user_note?: string;
}) {
  const analysis = await Promise.resolve(getCoreRepositories().analyses.findById(input.analysis_id));
  if (!analysis || analysis.account_id !== input.account_id) throw new Error("analysis_not_found");
  if (analysis.status !== "completed" || !analysis.result) throw new Error("analysis_not_report_ready");

  const snapshot = ensureReportSnapshotForAnalysis(analysis);
  const packet = buildValidationPacket({
    snapshot_id: snapshot.snapshot_id,
    analysis_id: analysis.analysis_id,
    artifact_id: analysis.artifact_id,
    trigger_limitation: input.trigger_limitation,
    requested_services: input.requested_services,
    snapshot_payload: snapshot.payload,
  });

  const now = new Date().toISOString();
  const request: ResearchDeskRequestRecord = {
    request_id: randomUUID(),
    report_snapshot_id: snapshot.snapshot_id,
    analysis_id: analysis.analysis_id,
    artifact_id: analysis.artifact_id,
    account_id: analysis.account_id,
    requested_by_user_id: input.requested_by_user_id,
    trigger_limitation: packet.trigger_limitation,
    requested_services: packet.requested_services,
    validation_packet: packet,
    status: "new",
    user_note: sanitizeOptionalText(input.user_note, 2000),
    created_at: now,
    updated_at: now,
  };

  researchDeskRepository.saveRequest(request);
  const learning_event = logRequestLearningEvent(request, now);
  return { request, learning_event };
}

export function listResearchDeskQueue(status?: string) {
  const normalizedStatus = status && isResearchDeskRequestStatus(status) ? status : undefined;
  return researchDeskRepository.listRequests(normalizedStatus);
}

export function listApprovedReportAddenda(reportSnapshotId: string) {
  return researchDeskRepository
    .listApprovedAddendaBySnapshot(reportSnapshotId)
    .filter((addendum) => Boolean(addendum.public_addendum));
}

export function updateResearchDeskRequest(input: {
  request_id: string;
  reviewer_user_id: string;
  status?: string;
  addendum_status?: string;
  internal_note?: string;
  public_addendum?: string;
}) {
  const request = researchDeskRepository.findRequestById(input.request_id);
  if (!request) throw new Error("research_desk_request_not_found");

  const now = new Date().toISOString();
  const requestStatus = normalizeRequestStatus(input.status);
  const addendumStatus = normalizeAddendumStatus(input.addendum_status);
  let updatedRequest = request;
  if (requestStatus) {
    updatedRequest = researchDeskRepository.updateRequestStatus(request.request_id, requestStatus, now) ?? request;
  }

  let addendum: ReviewerAddendumRecord | undefined;
  if (input.internal_note || input.public_addendum || addendumStatus) {
    const existing = researchDeskRepository.findAddendumByRequest(request.request_id);
    const status = addendumStatus ?? existing?.status ?? "draft";
    addendum = researchDeskRepository.upsertAddendum({
      addendum_id: existing?.addendum_id ?? randomUUID(),
      request_id: request.request_id,
      report_snapshot_id: request.report_snapshot_id,
      analysis_id: request.analysis_id,
      reviewer_user_id: input.reviewer_user_id,
      status,
      internal_note: sanitizeOptionalText(input.internal_note, 4000) ?? existing?.internal_note,
      public_addendum: sanitizeOptionalText(input.public_addendum, 4000) ?? existing?.public_addendum,
      created_at: existing?.created_at ?? now,
      updated_at: now,
      approved_at: status === "approved" ? now : undefined,
    }) ?? undefined;

    if (status === "approved") {
      updatedRequest = researchDeskRepository.updateRequestStatus(request.request_id, "addendum_approved", now) ?? updatedRequest;
      logAddendumLearningEvent(updatedRequest, now);
    }
  }

  return { request: updatedRequest, addendum };
}

function buildValidationPacket(input: {
  snapshot_id: string;
  analysis_id: string;
  artifact_id: string;
  trigger_limitation?: string;
  requested_services?: string[];
  snapshot_payload: {
    report_view: { limitations: string[]; recommendations: string[] };
    record: {
      strategy: { strategy_name: string };
      summary: { warnings: Array<{ title: string; message: string }> };
      report: { limitations: string[]; recommendations: string[] };
    };
    decision_metrics: Array<{ label: string; value: string; state?: string }>;
    warnings: string[];
  };
}): ValidationPacketTemplate {
  const limitations = uniqueNonEmpty([
    ...(input.snapshot_payload.report_view.limitations ?? []),
    ...(input.snapshot_payload.record.report.limitations ?? []),
    ...input.snapshot_payload.warnings,
  ]);
  const recommendations = uniqueNonEmpty([
    ...(input.snapshot_payload.report_view.recommendations ?? []),
    ...(input.snapshot_payload.record.report.recommendations ?? []),
  ]);
  const warnings = uniqueNonEmpty(input.snapshot_payload.record.summary.warnings.map((warning) => `${warning.title}: ${warning.message}`));
  const services = normalizeServices(input.requested_services);

  return {
    packet_version: "validation_packet_v1",
    analysis_id: input.analysis_id,
    artifact_id: input.artifact_id,
    report_snapshot_id: input.snapshot_id,
    strategy_name: input.snapshot_payload.record.strategy.strategy_name,
    generated_at: new Date().toISOString(),
    trigger_limitation: sanitizeOptionalText(input.trigger_limitation, 600) ?? limitations[0] ?? "General deeper validation request",
    requested_services: services.length ? services : DEFAULT_SERVICES,
    limitations,
    recommendations,
    warnings,
    decision_metrics: input.snapshot_payload.decision_metrics.slice(0, 8),
  };
}

function logRequestLearningEvent(request: ResearchDeskRequestRecord, now: string): WedgeLearningEventRecord {
  const learningKey = limitationLearningKey(request.trigger_limitation);
  const evidenceCount = researchDeskRepository.countLearningEvidence(learningKey) + 1;
  return researchDeskRepository.saveLearningEvent({
    event_id: randomUUID(),
    request_id: request.request_id,
    report_snapshot_id: request.report_snapshot_id,
    analysis_id: request.analysis_id,
    account_id: request.account_id,
    event_type: "research_desk_request_created",
    learning_key: learningKey,
    evidence_count: evidenceCount,
    promotion_candidate: evidenceCount >= PROMOTION_EVIDENCE_THRESHOLD,
    promoted_at: undefined,
    metadata: {
      trigger_limitation: request.trigger_limitation,
      requested_services: request.requested_services,
      promotion_threshold: PROMOTION_EVIDENCE_THRESHOLD,
    },
    created_at: now,
  });
}

function logAddendumLearningEvent(request: ResearchDeskRequestRecord, now: string): WedgeLearningEventRecord {
  const learningKey = `${limitationLearningKey(request.trigger_limitation)}:reviewer_approved`;
  const evidenceCount = researchDeskRepository.countLearningEvidence(learningKey) + 1;
  return researchDeskRepository.saveLearningEvent({
    event_id: randomUUID(),
    request_id: request.request_id,
    report_snapshot_id: request.report_snapshot_id,
    analysis_id: request.analysis_id,
    account_id: request.account_id,
    event_type: "reviewer_addendum_approved",
    learning_key: learningKey,
    evidence_count: evidenceCount,
    promotion_candidate: evidenceCount >= PROMOTION_EVIDENCE_THRESHOLD,
    promoted_at: undefined,
    metadata: { promotion_threshold: PROMOTION_EVIDENCE_THRESHOLD },
    created_at: now,
  });
}

function normalizeServices(values?: string[]) {
  return uniqueNonEmpty(values ?? []).filter(isResearchDeskService);
}

function normalizeRequestStatus(value?: string): ResearchDeskRequestStatus | undefined {
  return value && isResearchDeskRequestStatus(value) ? value : undefined;
}

function normalizeAddendumStatus(value?: string): ReviewerAddendumStatus | undefined {
  return value && isReviewerAddendumStatus(value) ? value : undefined;
}

function sanitizeOptionalText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

function uniqueNonEmpty(values: string[]) {
  return values.map((value) => value.trim()).filter((value, index, all) => value.length > 0 && all.indexOf(value) === index);
}

function limitationLearningKey(limitation: string) {
  const slug = limitation
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return `limitation:${slug || "general"}`;
}
