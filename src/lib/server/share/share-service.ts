import { createHash, randomBytes, randomUUID } from "node:crypto";
import { reportSnapshotRepository } from "@/lib/server/repositories/report-snapshot-repository";
import { shareAccessEventRepository, shareTokenRepository } from "@/lib/server/repositories/share-token-repository";
import { entitlementRepository } from "@/lib/server/accounts/repositories";
import { listApprovedReportAddenda } from "@/lib/server/research-desk/research-desk-service";
import { assertShareCanBeCreated, assertShareCanBeRevoked } from "@/lib/server/share/share-state-machine";
import { recordEvidenceEvent } from "@/lib/server/evidence/evidence-events";
import type { ReportSnapshotRecord } from "@/lib/server/exports/models";
import type { ShareTokenRecord, SharedReportViewModel } from "@/lib/server/share/models";

const DEFAULT_SHARE_TTL_DAYS = 30;

export function hashShareToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function hashOptional(value: string | undefined | null) {
  if (!value) return undefined;
  return createHash("sha256").update(value).digest("hex");
}

export function createReportShare(input: {
  report_snapshot_id: string;
  account_id: string;
  user_id: string;
  expires_at?: string;
}) {
  const snapshot = reportSnapshotRepository.findById(input.report_snapshot_id);
  if (!snapshot || snapshot.account_id !== input.account_id) throw new Error("report_snapshot_not_found");
  assertShareCanBeCreated(snapshot.status);
  const entitlements = entitlementRepository.get(input.account_id);
  if (!entitlements.can_create_share_links) throw new Error("share_plan_restricted");
  const existingShares = shareTokenRepository.listByAnalysis(snapshot.analysis_id).filter((share) => share.status === "active");
  if (existingShares.length >= entitlements.share_links_per_month) throw new Error("share_quota_reached");

  const token = randomBytes(32).toString("base64url");
  const now = new Date().toISOString();
  const expiresAt = input.expires_at ?? new Date(Date.now() + DEFAULT_SHARE_TTL_DAYS * 86_400_000).toISOString();
  const record = shareTokenRepository.save({
    share_id: randomUUID(),
    token_hash: hashShareToken(token),
    report_snapshot_id: snapshot.snapshot_id,
    analysis_id: snapshot.analysis_id,
    account_id: snapshot.account_id,
    created_by_user_id: input.user_id,
    status: "active",
    expires_at: expiresAt,
    created_at: now,
    updated_at: now,
  });

  recordEvidenceEvent({
    analysis_id: snapshot.analysis_id,
    account_id: snapshot.account_id,
    report_snapshot_id: snapshot.snapshot_id,
    share_id: record.share_id,
    event_type: "share_created",
    severity: "info",
    title: "Share Room link created",
    summary: "Recipient-safe Share Room access was created from the active report snapshot.",
    payload: { expires_at: expiresAt, redaction_policy: snapshot.payload.redaction_policy.policy_version },
    created_by_user_id: input.user_id,
    created_at: now,
  });

  return { token, share: record, url: `/share/${token}` };
}

export function revokeReportShare(input: { share_id: string; account_id: string; revoked_at?: string }) {
  const share = shareTokenRepository.findById(input.share_id);
  if (!share || share.account_id !== input.account_id) throw new Error("share_not_found");
  assertShareCanBeRevoked(share.status);
  if (share.status === "revoked") return share;
  const revoked = shareTokenRepository.revoke(share.share_id, input.revoked_at);
  if (revoked) {
    recordEvidenceEvent({
      analysis_id: revoked.analysis_id,
      account_id: revoked.account_id,
      report_snapshot_id: revoked.report_snapshot_id,
      share_id: revoked.share_id,
      event_type: "share_revoked",
      severity: "warning",
      title: "Share Room link revoked",
      summary: "Recipient access now fails closed for this share link.",
      payload: { revoked_at: revoked.revoked_at },
      created_at: revoked.revoked_at ?? new Date().toISOString(),
    });
  }
  return revoked;
}

export function resolveSharedReport(input: {
  token: string;
  ip?: string | null;
  userAgent?: string | null;
  now?: Date;
}): { status: SharedReportViewModel["status"] | "not_found"; view?: SharedReportViewModel } {
  const tokenHash = hashShareToken(input.token);
  const tokenHashPrefix = tokenHash.slice(0, 12);
  const share = shareTokenRepository.findByTokenHash(tokenHash);
  const now = input.now ?? new Date();

  if (!share) {
    auditShareAccess({ tokenHashPrefix, outcome: "not_found", ip: input.ip, userAgent: input.userAgent });
    return { status: "not_found" };
  }

  if (share.status === "revoked") {
    auditShareAccess({ share, tokenHashPrefix, outcome: "revoked", ip: input.ip, userAgent: input.userAgent });
    recordEvidenceEvent({
      analysis_id: share.analysis_id,
      account_id: share.account_id,
      report_snapshot_id: share.report_snapshot_id,
      share_id: share.share_id,
      event_type: "share_revoked",
      severity: "warning",
      title: "Revoked share access attempted",
      summary: "A revoked Share Room token was rejected.",
      payload: { token_hash_prefix: tokenHashPrefix },
    });
    return { status: "revoked" };
  }

  if (share.expires_at && new Date(share.expires_at).getTime() <= now.getTime()) {
    auditShareAccess({ share, tokenHashPrefix, outcome: "expired", ip: input.ip, userAgent: input.userAgent });
    recordEvidenceEvent({
      analysis_id: share.analysis_id,
      account_id: share.account_id,
      report_snapshot_id: share.report_snapshot_id,
      share_id: share.share_id,
      event_type: "share_expired",
      severity: "warning",
      title: "Expired share access attempted",
      summary: "An expired Share Room token was rejected.",
      payload: { token_hash_prefix: tokenHashPrefix, expires_at: share.expires_at },
    });
    return { status: "expired" };
  }

  const snapshot = reportSnapshotRepository.findById(share.report_snapshot_id);
  if (!snapshot) {
    auditShareAccess({ share, tokenHashPrefix, outcome: "not_found", ip: input.ip, userAgent: input.userAgent });
    return { status: "not_found" };
  }

  if (snapshot.status === "superseded") {
    auditShareAccess({ share, tokenHashPrefix, outcome: "superseded", ip: input.ip, userAgent: input.userAgent });
    return { status: "superseded", view: buildSharedReportView(share, snapshot, "superseded") };
  }

  auditShareAccess({ share, tokenHashPrefix, outcome: "viewed", ip: input.ip, userAgent: input.userAgent });
  recordEvidenceEvent({
    analysis_id: share.analysis_id,
    account_id: share.account_id,
    report_snapshot_id: share.report_snapshot_id,
    share_id: share.share_id,
    event_type: "share_viewed",
    severity: "info",
    title: "Share Room viewed",
    summary: "A recipient opened the share-safe report view.",
    payload: { token_hash_prefix: tokenHashPrefix },
  });
  return { status: "available", view: buildSharedReportView(share, snapshot, "available") };
}

function buildSharedReportView(
  share: ShareTokenRecord,
  snapshot: ReportSnapshotRecord,
  status: SharedReportViewModel["status"],
): SharedReportViewModel {
  const record = snapshot.payload.record;
  const reviewerAddenda = listApprovedReportAddenda(snapshot.snapshot_id);
  return {
    share_id: share.share_id,
    snapshot_id: snapshot.snapshot_id,
    status,
    generated_at: snapshot.payload.generated_at,
    expires_at: share.expires_at,
    strategy_name: record.strategy.strategy_name,
    dataset: {
      trade_count: record.dataset.trade_count,
      market: record.dataset.market,
      start_date: record.dataset.start_date,
      end_date: record.dataset.end_date,
    },
    verdict: snapshot.payload.report_view.verdict,
    confidence: snapshot.payload.report_view.confidence,
    decision_metrics: snapshot.payload.decision_metrics,
    diagnostics_summary: snapshot.payload.report_view.diagnosticsSummary,
    methodology: snapshot.payload.report_view.methodology,
    limitations: snapshot.payload.report_view.limitations,
    recommendations: snapshot.payload.report_view.recommendations,
    deployment_guidance: snapshot.payload.report_view.deploymentGuidance,
    redaction_policy: snapshot.payload.redaction_policy,
    download_policy: {
      public_pdf_download: false,
      owner_exports_required: true,
      formats: ["view_only"],
    },
    unsupported_claims: (record.claim_inventory ?? [])
      .filter((claim) => ["unsupported", "contradicted", "outside_scope"].includes(claim.support_status))
      .map((claim) => ({
        claim: claim.claim,
        support_status: claim.support_status,
        report_wording: claim.report_wording,
        missing_evidence: claim.missing_evidence,
      })),
    what_this_result_does_not_prove: snapshot.payload.proof_report?.what_this_result_does_not_prove ?? [],
    excluded_diagnostics: snapshot.payload.excluded_diagnostics,
    evidence_ledger: (snapshot.payload.evidence_ledger?.diagnostics ?? []).map((entry) => ({
      diagnostic: entry.diagnostic,
      final_status: entry.final_status,
      display_status: entry.display_status,
      artifact_reason: entry.artifact_reason,
      engine_reason: entry.engine_reason,
    })),
    warnings: snapshot.payload.warnings,
    reviewer_addenda: reviewerAddenda.map((addendum) => ({
      addendum_id: addendum.addendum_id,
      public_addendum: addendum.public_addendum ?? "",
      approved_at: addendum.approved_at,
    })),
  };
}

function auditShareAccess(input: {
  share?: ShareTokenRecord;
  tokenHashPrefix: string;
  outcome: "viewed" | "not_found" | "expired" | "revoked" | "superseded";
  ip?: string | null;
  userAgent?: string | null;
}) {
  shareAccessEventRepository.save({
    event_id: randomUUID(),
    share_id: input.share?.share_id,
    token_hash_prefix: input.tokenHashPrefix,
    report_snapshot_id: input.share?.report_snapshot_id,
    outcome: input.outcome,
    ip_hash: hashOptional(input.ip),
    user_agent_hash: hashOptional(input.userAgent),
    created_at: new Date().toISOString(),
  });
}
