import { randomUUID } from "node:crypto";
import { accountService } from "@/lib/server/accounts/service";
import { sendTransactionalEmail } from "@/lib/server/email/email-service";
import { recordEvidenceEvent } from "@/lib/server/evidence/evidence-events";
import type { ReportSnapshotPayload } from "@/lib/server/exports/models";
import { ensureReportSnapshotForAnalysis } from "@/lib/server/exports/report-snapshot-service";
import type { UploadArtifact } from "@/lib/server/analysis/models";
import { getCoreRepositories } from "@/lib/server/persistence/repositories";
import { researchDeskRepository } from "@/lib/server/repositories/research-desk-repository";
import {
  canonicalResearchDeskService,
  canonicalResearchDeskStatus,
  isResearchDeskRequestStatus,
  isReviewerAddendumStatus,
  type ResearchDeskRequestRecord,
  type ResearchDeskRequestStatus,
  type ResearchDeskService,
  type ResearchDeskTimelineEvent,
  type ReviewerAddendumRecord,
  type ReviewerAddendumStatus,
  type ValidationPacketTemplate,
  type WedgeLearningEventRecord,
} from "@/lib/server/research-desk/models";

const DEFAULT_SERVICES: ResearchDeskService[] = ["execution_audit", "data_quality_audit", "benchmark_construction"];
const PROMOTION_EVIDENCE_THRESHOLD = 3;
const STATUS_FLOW: ResearchDeskRequestStatus[] = ["received", "scoped", "quoted", "in_review", "addendum_draft", "approved", "delivered", "closed"];
const STATUS_COPY: Record<ResearchDeskRequestStatus, { label: string; description: string }> = {
  received: { label: "Received", description: "Request packet captured with report, artifact, evidence, assumptions, and client context." },
  scoped: { label: "Scoped", description: "Reviewer has mapped the request to concrete review work and evidence gaps." },
  quoted: { label: "Quoted", description: "Commercial scope, expected turnaround, and review boundaries have been set." },
  in_review: { label: "In review", description: "Research Desk is reviewing the packet and preparing decision-grade context." },
  addendum_draft: { label: "Addendum draft", description: "A reviewer addendum exists but is not yet approved for the report snapshot." },
  approved: { label: "Approved", description: "Approved addendum is attached to the immutable report snapshot." },
  delivered: { label: "Delivered", description: "Client-facing review output has been delivered." },
  closed: { label: "Closed", description: "Research Desk follow-up is complete for this request." },
};

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
  const state = await accountService.getAccountState(input.account_id);
  if (!state?.entitlements.can_request_research_desk) throw new Error("research_desk_plan_restricted");

  const snapshot = await ensureReportSnapshotForAnalysis(analysis);
  const artifact = await Promise.resolve(getCoreRepositories().artifacts.findById(analysis.artifact_id));
  const packet = buildValidationPacket({
    snapshot_id: snapshot.snapshot_id,
    analysis_id: analysis.analysis_id,
    artifact_id: analysis.artifact_id,
    trigger_limitation: input.trigger_limitation,
    requested_services: input.requested_services,
    client_note: input.user_note,
    snapshot_payload: snapshot.payload,
    artifact,
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
    status: "received",
    user_note: sanitizeOptionalText(input.user_note, 2000),
    created_at: now,
    updated_at: now,
  };

  await researchDeskRepository.saveRequest(request);
  const learning_event = await logRequestLearningEvent(request, now);
  await recordEvidenceEvent({
    analysis_id: request.analysis_id,
    account_id: request.account_id,
    artifact_id: request.artifact_id,
    report_snapshot_id: request.report_snapshot_id,
    event_type: "research_desk_packet_created",
    severity: "info",
    title: "Research Desk packet created",
    summary: `${request.requested_services.length} review scopes requested for ${request.trigger_limitation}.`,
    payload: {
      request_id: request.request_id,
      requested_services: request.requested_services,
      packet_version: request.validation_packet.packet_version,
    },
    created_by_user_id: request.requested_by_user_id,
    created_at: now,
  });
  await accountService.incrementUsage(input.account_id, "research_desk");
  await notifyResearchDeskRequestCreated(request);
  return { request, learning_event };
}

export async function listResearchDeskQueue(status?: string) {
  const normalizedStatus = status && isResearchDeskRequestStatus(status) ? status : undefined;
  return await researchDeskRepository.listRequests(normalizedStatus);
}

export async function listApprovedReportAddenda(reportSnapshotId: string) {
  return (await researchDeskRepository.listApprovedAddendaBySnapshot(reportSnapshotId))
    .filter((addendum) => Boolean(addendum.public_addendum));
}

export async function listResearchDeskRequestsForAnalysis(input: { analysis_id: string; account_id: string }) {
  const requests = (await researchDeskRepository.listRequestsByAnalysis(input.analysis_id))
    .filter((request) => request.account_id === input.account_id);
  return await Promise.all(requests.map(async (request) => ({ request, timeline: buildResearchDeskTimeline(request, await researchDeskRepository.findAddendumByRequest(request.request_id)) })));
}

export async function updateResearchDeskRequest(input: {
  request_id: string;
  reviewer_user_id: string;
  status?: string;
  addendum_status?: string;
  internal_note?: string;
  public_addendum?: string;
}) {
  const request = await researchDeskRepository.findRequestById(input.request_id);
  if (!request) throw new Error("research_desk_request_not_found");

  const now = new Date().toISOString();
  const requestStatus = normalizeRequestStatus(input.status);
  const addendumStatus = normalizeAddendumStatus(input.addendum_status);
  let updatedRequest = request;
  if (requestStatus) {
    updatedRequest = await researchDeskRepository.updateRequestStatus(request.request_id, requestStatus, now) ?? request;
    await recordEvidenceEvent({
      analysis_id: request.analysis_id,
      account_id: request.account_id,
      artifact_id: request.artifact_id,
      report_snapshot_id: request.report_snapshot_id,
      event_type: "research_desk_status_updated",
      severity: "info",
      title: "Research Desk status updated",
      summary: `Research Desk request moved from ${request.status} to ${updatedRequest.status}.`,
      payload: {
        request_id: request.request_id,
        previous_status: request.status,
        status: updatedRequest.status,
      },
      created_by_user_id: input.reviewer_user_id,
      created_at: now,
    });
  }

  let addendum: ReviewerAddendumRecord | undefined;
  if (input.internal_note || input.public_addendum || addendumStatus) {
    const existing = await researchDeskRepository.findAddendumByRequest(request.request_id);
    const status = addendumStatus ?? existing?.status ?? "draft";
    addendum = await researchDeskRepository.upsertAddendum({
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
      updatedRequest = await researchDeskRepository.updateRequestStatus(request.request_id, "approved", now) ?? updatedRequest;
      await logAddendumLearningEvent(updatedRequest, now);
      await recordEvidenceEvent({
        analysis_id: request.analysis_id,
        account_id: request.account_id,
        artifact_id: request.artifact_id,
        report_snapshot_id: request.report_snapshot_id,
        event_type: "research_desk_addendum_approved",
        severity: "info",
        title: "Research Desk addendum approved",
        summary: "Approved reviewer context is attached to the report snapshot.",
        payload: {
          request_id: request.request_id,
          addendum_id: addendum?.addendum_id,
          has_public_addendum: Boolean(addendum?.public_addendum),
        },
        created_by_user_id: input.reviewer_user_id,
        created_at: now,
      });
    } else if (!requestStatus) {
      updatedRequest = await researchDeskRepository.updateRequestStatus(request.request_id, "addendum_draft", now) ?? updatedRequest;
    }
  }

  await notifyResearchDeskRequestUpdated(updatedRequest, addendum, request.status !== updatedRequest.status);
  return { request: updatedRequest, addendum };
}

function buildValidationPacket(input: {
  snapshot_id: string;
  analysis_id: string;
  artifact_id: string;
  trigger_limitation?: string;
  requested_services?: string[];
  client_note?: string;
  artifact?: UploadArtifact;
  snapshot_payload: ReportSnapshotPayload;
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
  const unsupportedClaims = (input.snapshot_payload.record.claim_inventory ?? []).filter((claim) => {
    const status = String(claim.support_status ?? "");
    return ["unsupported", "contradicted", "outside_scope"].includes(status);
  });
  const diagnosticBundle = input.snapshot_payload.record.diagnostics as unknown as Record<string, {
    metrics?: Array<{ label: string; value: string; state?: string }>;
    limitations?: string[];
    recommendations?: string[];
  }>;
  const diagnosticOutputs = Object.entries(input.snapshot_payload.record.diagnostic_statuses ?? {}).map(([diagnostic, status]) => {
    const output = diagnosticBundle[diagnostic] ?? {};
    return {
      diagnostic,
      status: status.status,
      reason: status.reason,
      metrics: (output.metrics ?? []).slice(0, 8),
      limitations: uniqueNonEmpty(output.limitations ?? []).slice(0, 8),
      recommendations: uniqueNonEmpty(output.recommendations ?? []).slice(0, 8),
    };
  });
  const normalizedServices = services.length ? services : DEFAULT_SERVICES;
  const requestedQuestions = buildRequestedQuestions(normalizedServices, limitations, unsupportedClaims);

  return {
    packet_version: "validation_packet_v2",
    analysis_id: input.analysis_id,
    artifact_id: input.artifact_id,
    report_snapshot_id: input.snapshot_id,
    strategy_name: input.snapshot_payload.record.strategy.strategy_name,
    generated_at: new Date().toISOString(),
    trigger_limitation: sanitizeOptionalText(input.trigger_limitation, 600) ?? limitations[0] ?? "General deeper validation request",
    requested_services: normalizedServices,
    requested_questions: requestedQuestions,
    client_note: sanitizeOptionalText(input.client_note, 2000),
    artifact_manifest: {
      artifact_id: input.artifact_id,
      file_name: input.artifact?.file_name ?? input.snapshot_payload.artifact_identity?.file_name,
      file_type: input.artifact?.file_type,
      file_size_bytes: input.artifact?.file_size_bytes,
      checksum_sha256: input.artifact?.checksum_sha256 ?? input.snapshot_payload.artifact_identity?.checksum_sha256,
      artifact_kind: input.artifact?.artifact_kind ?? input.snapshot_payload.artifact_identity?.artifact_kind,
      richness: input.artifact?.richness ?? input.snapshot_payload.artifact_identity?.richness,
      uploaded_at: input.artifact?.uploaded_at,
      eligibility_summary: input.artifact?.eligibility_summary,
    },
    evidence_ledger: input.snapshot_payload.evidence_ledger?.diagnostics ?? [],
    assumption_ledger: (input.snapshot_payload.record.assumption_ledger ?? []).map((item) => ({ ...item })),
    unsupported_claims: unsupportedClaims.map((claim) => ({ ...claim })),
    diagnostic_outputs: diagnosticOutputs,
    limitations,
    recommendations,
    warnings,
    decision_metrics: input.snapshot_payload.decision_metrics.slice(0, 8),
    reviewer_checklist: buildReviewerChecklist(normalizedServices, limitations, unsupportedClaims),
  };
}

async function logRequestLearningEvent(request: ResearchDeskRequestRecord, now: string): Promise<WedgeLearningEventRecord> {
  const learningKey = limitationLearningKey(request.trigger_limitation);
  const evidenceCount = await researchDeskRepository.countLearningEvidence(learningKey) + 1;
  return await researchDeskRepository.saveLearningEvent({
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

async function logAddendumLearningEvent(request: ResearchDeskRequestRecord, now: string): Promise<WedgeLearningEventRecord> {
  const learningKey = `${limitationLearningKey(request.trigger_limitation)}:reviewer_approved`;
  const evidenceCount = await researchDeskRepository.countLearningEvidence(learningKey) + 1;
  return await researchDeskRepository.saveLearningEvent({
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
  return uniqueNonEmpty(values ?? [])
    .map((value) => canonicalResearchDeskService(value))
    .filter((value): value is ResearchDeskService => Boolean(value));
}

function normalizeRequestStatus(value?: string): ResearchDeskRequestStatus | undefined {
  return value ? canonicalResearchDeskStatus(value) : undefined;
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

export function buildResearchDeskTimeline(request: ResearchDeskRequestRecord, addendum?: ReviewerAddendumRecord): ResearchDeskTimelineEvent[] {
  const currentIndex = Math.max(0, STATUS_FLOW.indexOf(request.status));
  return STATUS_FLOW.map((status, index) => {
    const copy = STATUS_COPY[status];
    const complete = index < currentIndex || request.status === "closed";
    const current = index === currentIndex && request.status !== "closed";
    const at = status === "received"
      ? request.created_at
      : status === "approved" && addendum?.approved_at
        ? addendum.approved_at
        : complete || current
          ? request.updated_at
          : undefined;
    return { status, label: copy.label, description: copy.description, at, state: complete ? "complete" : current ? "current" : "pending" };
  });
}

function buildRequestedQuestions(services: ResearchDeskService[], limitations: string[], unsupportedClaims: Array<{ claim?: string }>) {
  const questions = services.map((service) => {
    if (service === "execution_audit") return "Do execution assumptions, fees, slippage, and fill realism materially change the strategy verdict?";
    if (service === "data_quality_audit") return "Are the uploaded records complete, internally consistent, and suitable for the claims being made?";
    if (service === "benchmark_construction") return "Which benchmark or null model is needed to test whether the edge survives comparison?";
    if (service === "parameter_stability_review") return "Is the strategy robust across reasonable parameter changes, or is the result parameter-lucky?";
    if (service === "regime_context_review") return "Which market regimes explain performance, fragility, or missing context?";
    if (service === "claim_validation") return "Which claims should be narrowed, supported with more evidence, or removed from the report?";
    return "What report language would be defensible for an investor, buyer, or internal committee?";
  });
  return uniqueNonEmpty([
    ...questions,
    ...(limitations[0] ? [`What evidence would resolve this limitation: ${limitations[0]}`] : []),
    ...(unsupportedClaims[0]?.claim ? [`Can this claim be defended: ${String(unsupportedClaims[0].claim)}`] : []),
  ]).slice(0, 10);
}

function buildReviewerChecklist(services: ResearchDeskService[], limitations: string[], unsupportedClaims: unknown[]) {
  return uniqueNonEmpty([
    "Confirm the request is tied to the intended report snapshot before reviewing.",
    "Review the artifact manifest and evidence ledger before interpreting diagnostics.",
    "Separate missing evidence from plan-gated or engine-limited diagnostics.",
    ...(limitations.length ? ["Address the trigger limitation directly in the public addendum."] : []),
    ...(unsupportedClaims.length ? ["State which unsupported claims remain unsupported after review."] : []),
    ...(services.includes("execution_audit") ? ["Check whether execution-cost assumptions can flip the verdict."] : []),
    ...(services.includes("benchmark_construction") ? ["Specify the benchmark construction needed for a fair comparison."] : []),
    ...(services.includes("parameter_stability_review") ? ["Call out parameter-luck risk and required sweep evidence."] : []),
    ...(services.includes("regime_context_review") ? ["State whether OHLCV/regime evidence is sufficient for context claims."] : []),
    "Approve only report-safe language that does not overstate automated proof.",
  ]);
}

async function notifyResearchDeskRequestCreated(request: ResearchDeskRequestRecord) {
  const repositories = getCoreRepositories();
  const user = await repositories.users.findById(request.requested_by_user_id);
  const adminEmails = getResearchDeskAdminEmails();
  await Promise.all([
    user?.email ? safeSendResearchDeskEmail({
      to: user.email,
      kind: "research_desk_request",
      subject: "Research Desk request received",
      text: `Your Research Desk request for ${request.validation_packet.strategy_name} was received. Request ${request.request_id}.`,
      html: `<p>Your Research Desk request for <strong>${request.validation_packet.strategy_name}</strong> was received.</p><p>Request ${request.request_id}</p>`,
    }) : Promise.resolve(),
    ...adminEmails.map((email) => safeSendResearchDeskEmail({
      to: email,
      kind: "research_desk_request",
      subject: "New Research Desk request",
      text: `New Research Desk request ${request.request_id} for ${request.validation_packet.strategy_name}: ${request.trigger_limitation}`,
      html: `<p>New Research Desk request <strong>${request.request_id}</strong>.</p><p>${request.trigger_limitation}</p>`,
    })),
  ]);
}

async function notifyResearchDeskRequestUpdated(request: ResearchDeskRequestRecord, addendum: ReviewerAddendumRecord | undefined, statusChanged: boolean) {
  if (!statusChanged && addendum?.status !== "approved") return;
  const user = await getCoreRepositories().users.findById(request.requested_by_user_id);
  if (!user?.email) return;
  await safeSendResearchDeskEmail({
    to: user.email,
    kind: addendum?.status === "approved" ? "research_desk_addendum" : "research_desk_status",
    subject: addendum?.status === "approved" ? "Research Desk addendum approved" : `Research Desk status: ${STATUS_COPY[request.status].label}`,
    text: addendum?.status === "approved"
      ? `An approved Research Desk addendum is now attached to ${request.validation_packet.strategy_name}.`
      : `Your Research Desk request is now ${STATUS_COPY[request.status].label}.`,
    html: addendum?.status === "approved"
      ? `<p>An approved Research Desk addendum is now attached to <strong>${request.validation_packet.strategy_name}</strong>.</p>`
      : `<p>Your Research Desk request is now <strong>${STATUS_COPY[request.status].label}</strong>.</p>`,
  });
}

async function safeSendResearchDeskEmail(input: { to: string; kind: "research_desk_request" | "research_desk_status" | "research_desk_addendum"; subject: string; text: string; html: string }) {
  try {
    await sendTransactionalEmail({ ...input, devLink: `${appUrl()}/app` });
  } catch {
    // Research Desk state changes should persist even if outbound email is unavailable.
  }
}

function getResearchDeskAdminEmails() {
  return (process.env.RESEARCH_DESK_ADMIN_EMAILS || process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

function appUrl() {
  return (process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
}
