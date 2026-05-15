import { createHash, randomUUID } from "node:crypto";
import type { AnalysisRecord } from "@/lib/contracts";
import { buildDecisionSnapshotMetrics, buildReportViewModel } from "@/lib/app/report-view";
import { buildEvidenceLedger } from "@/lib/server/evidence/evidence-ledger-service";
import type { AnalysisEntity } from "@/lib/server/analysis/models";
import type { EngineCapabilityProfile } from "@/lib/server/engine/engine-types";
import type { ReportSnapshotPayload, ReportSnapshotRecord } from "@/lib/server/exports/models";
import { reportSnapshotRepository } from "@/lib/server/repositories/report-snapshot-repository";

export function checksumAnalysisResult(record: AnalysisRecord): string {
  return createHash("sha256").update(stableStringify(record)).digest("hex");
}

export function getReportSnapshotState(analysis: AnalysisEntity): {
  active?: ReportSnapshotRecord;
  current_checksum?: string;
  stale: boolean;
  warnings: string[];
} {
  const active = reportSnapshotRepository.findActiveByAnalysis(analysis.analysis_id);
  const currentChecksum = analysis.result ? checksumAnalysisResult(analysis.result) : undefined;
  const stale = Boolean(active && currentChecksum && active.source_result_checksum !== currentChecksum);
  const warnings = [
    ...(active?.payload.warnings ?? []),
    ...(stale ? ["Report snapshot is stale because the source analysis result changed after snapshot generation."] : []),
    ...(active?.status === "superseded" ? ["Report snapshot has been superseded by a newer immutable artifact."] : []),
  ];
  return { active, current_checksum: currentChecksum, stale, warnings };
}

export function ensureReportSnapshotForAnalysis(analysis: AnalysisEntity): ReportSnapshotRecord {
  if (analysis.status !== "completed") throw new Error("analysis_not_completed");
  if (!analysis.result) throw new Error("analysis_result_missing");
  if (!analysis.eligibility_snapshot) throw new Error("analysis_eligibility_missing");

  const checksum = checksumAnalysisResult(analysis.result);
  const existing = reportSnapshotRepository.findByAnalysisAndChecksum(analysis.analysis_id, checksum);
  if (existing) {
    if (existing.status !== "active") {
      const now = new Date().toISOString();
      reportSnapshotRepository.markActive(existing.snapshot_id);
      reportSnapshotRepository.supersedeActiveForAnalysis(analysis.analysis_id, existing.snapshot_id, now);
      return reportSnapshotRepository.findById(existing.snapshot_id) ?? existing;
    }
    return existing;
  }

  const now = new Date().toISOString();
  const snapshotId = randomUUID();
  const payload = buildReportSnapshotPayload({
    snapshot_id: snapshotId,
    analysis,
    record: analysis.result,
    checksum,
    generated_at: now,
  });

  const snapshot = reportSnapshotRepository.save({
    snapshot_id: snapshotId,
    analysis_id: analysis.analysis_id,
    account_id: analysis.account_id,
    status: "active",
    source_analysis_updated_at: analysis.updated_at,
    source_result_checksum: checksum,
    payload,
    warning_count: payload.warnings.length,
    created_at: now,
  });

  reportSnapshotRepository.supersedeActiveForAnalysis(analysis.analysis_id, snapshot.snapshot_id, now);
  return snapshot;
}

function buildReportSnapshotPayload(input: {
  snapshot_id: string;
  analysis: AnalysisEntity;
  record: AnalysisRecord;
  checksum: string;
  generated_at: string;
}): ReportSnapshotPayload {
  const { analysis, record } = input;
  const capabilityProfile = Object.fromEntries(
    Object.entries(record.diagnostic_statuses).map(([diagnostic, status]) => [
      diagnostic,
      { status: status.status, reason: status.reason },
    ]),
  ) as EngineCapabilityProfile;
  const evidenceLedger = analysis.eligibility_snapshot
    ? buildEvidenceLedger({ eligibility: analysis.eligibility_snapshot, capabilityProfile })
    : undefined;
  const warnings = [
    ...(evidenceLedger?.warnings ?? []),
    ...record.summary.warnings.map((warning) => warning.message),
    ...Object.values(record.diagnostic_statuses)
      .filter((status) => status.status !== "available")
      .map((status) => status.reason)
      .filter((reason): reason is string => Boolean(reason)),
  ].filter((warning, index, all) => warning.length > 0 && all.indexOf(warning) === index);

  return {
    snapshot_id: input.snapshot_id,
    analysis_id: analysis.analysis_id,
    generated_at: input.generated_at,
    source_analysis_updated_at: analysis.updated_at,
    source_result_checksum: input.checksum,
    record,
    report_view: buildReportViewModel(record),
    decision_metrics: buildDecisionSnapshotMetrics(record),
    evidence_ledger: evidenceLedger,
    warnings,
  };
}

function stableStringify(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}
