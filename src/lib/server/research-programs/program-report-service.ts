import { randomBytes, randomUUID } from "node:crypto";
import { accountService } from "@/lib/server/accounts/service";
import { ensureReportSnapshotForAnalysis } from "@/lib/server/exports/report-snapshot-service";
import { getCoreRepositories } from "@/lib/server/persistence/repositories";
import { researchDeskRepository } from "@/lib/server/repositories/research-desk-repository";
import { reportSnapshotRepository } from "@/lib/server/repositories/report-snapshot-repository";
import { researchProgramRepository } from "@/lib/server/research-programs/repository";
import { getResearchProgramDetail } from "@/lib/server/research-programs/service";
import type {
  ExperimentJobEventRecord,
  ProgramDetail,
  ProgramReportPayload,
  ProgramReportSnapshot,
} from "@/lib/server/research-programs/models";
import { hashShareToken } from "@/lib/server/share/share-service";
import { assertProgramShareAllowed } from "@/lib/server/entitlements/research-policy";
import type { ExportFormat } from "@/lib/server/exports/models";
import type { ResearchDeskService, ValidationPacketTemplate } from "@/lib/server/research-desk/models";

const DEFAULT_PROGRAM_SHARE_TTL_DAYS = 30;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function unique(items: Array<string | undefined>) {
  return [...new Set(items.map((item) => item?.trim()).filter((item): item is string => Boolean(item)))];
}

function latestEventForJob(events: ExperimentJobEventRecord[], jobId: string) {
  return events.find((event) => event.experiment_job_id === jobId);
}

function cardSummary(event: ExperimentJobEventRecord | undefined) {
  return asRecord(asRecord(event?.payload).card_summary);
}

function artifactSummary(event: ExperimentJobEventRecord | undefined) {
  return asRecord(asRecord(event?.payload).artifact_summary);
}

function buildProgramReportPayload(detail: ProgramDetail, generatedAt: string): ProgramReportPayload {
  const eventsByJob = new Map(detail.experiment_jobs.map((job) => [job.experiment_job_id, latestEventForJob(detail.experiment_job_events, job.experiment_job_id)]));
  const experiments = detail.experiment_jobs.map((job) => {
    const summary = cardSummary(eventsByJob.get(job.experiment_job_id));
    return {
      experiment_job_id: job.experiment_job_id,
      status: job.status,
      current_step: job.current_step,
      progress_pct: job.progress_pct,
      verdict: typeof summary.verdict === "string" ? summary.verdict : undefined,
      confidence: typeof summary.confidence === "string" ? summary.confidence : undefined,
      decision_grade: typeof summary.decision_grade === "boolean" ? summary.decision_grade : undefined,
      recommended_action: typeof summary.recommended_action === "string" ? summary.recommended_action : undefined,
      artifact_summary: artifactSummary(eventsByJob.get(job.experiment_job_id)),
      last_error: job.last_error,
      created_at: job.created_at,
      finished_at: job.finished_at,
    };
  });

  const findings = detail.memory.findings.map((finding) => ({
    headline: finding.headline,
    detail: finding.detail,
    severity: finding.severity,
  }));
  const recommendations = detail.memory.recommendations.map((recommendation) => ({
    recommendation: recommendation.recommendation,
    status: recommendation.status,
    confidence: recommendation.confidence,
  }));
  const memorySummary = {
    items: detail.memory.items.length,
    findings,
    recommendations,
    similar_signatures: detail.memory.similar_runs.map((run) => run.signature).slice(0, 20),
  };
  const verdictCards = detail.experiment_job_events
    .map((event) => cardSummary(event))
    .filter((summary) => Object.keys(summary).length > 0);
  const runArtifacts = detail.experiment_job_events
    .map((event) => artifactSummary(event))
    .filter((summary) => Object.keys(summary).length > 0);

  return {
    schema_version: "program_report_snapshot_v1",
    program_id: detail.program.program_id,
    title: `${detail.program.title} research milestone`,
    generated_at: generatedAt,
    research_question: {
      thesis: detail.program.thesis,
      market: detail.program.market,
      asset_universe: detail.program.asset_universe,
      timeframe: detail.program.timeframe,
    },
    hypotheses_tested: detail.hypothesis_versions.map((version) => ({
      hypothesis_version_id: version.hypothesis_version_id,
      title: version.spec.title,
      thesis: version.spec.thesis,
      status: version.status,
      invalidation_criteria: version.spec.invalidation_criteria,
      required_datasets: version.spec.required_datasets,
    })),
    experiments_run: experiments,
    rejected_variants: [
      ...experiments
        .filter((experiment) => experiment.status === "failed")
        .map((experiment) => ({
          title: `Run ${experiment.experiment_job_id.slice(0, 8)}`,
          reason: experiment.last_error ?? experiment.current_step,
          evidence: { experiment_job_id: experiment.experiment_job_id, status: experiment.status },
        })),
      ...findings
        .filter((finding) => finding.severity === "critical")
        .map((finding) => ({
          title: finding.headline,
          reason: finding.detail,
          evidence: { severity: finding.severity },
        })),
    ],
    surviving_candidates: [
      ...experiments
        .filter((experiment) => experiment.status === "completed")
        .map((experiment) => ({
          title: `Run ${experiment.experiment_job_id.slice(0, 8)}`,
          support: experiment.verdict ? experiment.verdict.replace(/_/g, " ") : "completed experiment",
          evidence: { confidence: experiment.confidence, decision_grade: experiment.decision_grade },
        })),
      ...detail.memory.recommendations
        .filter((recommendation) => recommendation.status === "accepted" || recommendation.status === "completed")
        .map((recommendation) => ({
          title: recommendation.recommendation_type.replace(/_/g, " "),
          support: recommendation.recommendation,
          evidence: { confidence: recommendation.confidence, status: recommendation.status },
        })),
    ],
    evidence_limits: unique([
      detail.analyses.length === 0 ? "No Approach A audit import is attached to this program yet." : undefined,
      experiments.length === 0 ? "No engine experiment run is attached to this program yet." : undefined,
      verdictCards.length === 0 ? "No terminal verdict-card packet has been recorded yet." : undefined,
      ...findings.filter((finding) => finding.severity !== "info").map((finding) => finding.detail),
    ]),
    next_experiment_plan: unique([
      ...detail.experiment_plan_items
        .filter((item) => item.status === "queued" || item.status === "draft")
        .sort((a, b) => b.priority - a.priority)
        .map((item) => `${item.title}: ${item.falsification_question}`),
      ...recommendations
        .filter((recommendation) => recommendation.status === "proposed" || recommendation.status === "accepted")
        .map((recommendation) => recommendation.recommendation),
    ]).slice(0, 12),
    memory_summary: memorySummary,
    imports: detail.analyses.map((analysis) => ({
      analysis_id: analysis.analysis_id,
      strategy_name: analysis.strategy_name,
      status: analysis.status,
      trade_count: analysis.trade_count,
      robustness_score: analysis.robustness_score,
    })),
    research_desk_packet: {
      hypothesis_specs: detail.hypothesis_versions.map((version) => version.hypothesis_version_id),
      strategy_specs: detail.strategy_specs.map((spec) => spec.strategy_spec_record_id),
      experiment_plans: detail.experiment_plans.map((plan) => plan.experiment_plan_id),
      run_artifacts: runArtifacts,
      verdict_cards: verdictCards,
      memory_summary: memorySummary,
    },
    redaction_policy: {
      policy_version: "program_share_room_redaction_v1",
      public_share_excludes: [
        "raw trade files",
        "raw engine artifacts",
        "owner account identifiers",
        "owner user identifiers",
        "storage keys",
        "private notes",
      ],
      public_share_includes: [
        "research question",
        "hypotheses tested",
        "experiment outcomes",
        "surviving candidates",
        "rejected variants",
        "evidence limits",
        "memory summary",
        "next experiment plan",
      ],
      raw_artifacts_public: false,
      pii_exposure: "none",
    },
  };
}

async function backingAnalysisSnapshot(detail: ProgramDetail) {
  const completedImport = detail.analyses.find((analysis) => analysis.status === "completed");
  if (!completedImport) return undefined;
  const analysis = await getCoreRepositories().analyses.findById(completedImport.analysis_id);
  if (!analysis || analysis.account_id !== detail.program.account_id || analysis.status !== "completed" || !analysis.result) return undefined;
  return ensureReportSnapshotForAnalysis(analysis);
}

export async function createProgramReportSnapshot(input: {
  program_id: string;
  account_id: string;
  user_id?: string;
}): Promise<ProgramReportSnapshot> {
  const detail = await getResearchProgramDetail(input.program_id, input.account_id);
  if (!detail) throw new Error("program_not_found");
  if (detail.experiment_jobs.length === 0 && detail.analyses.length === 0) throw new Error("program_report_not_ready");

  const now = new Date().toISOString();
  const backingSnapshot = await backingAnalysisSnapshot(detail);
  const report: ProgramReportSnapshot = {
    program_report_snapshot_id: randomUUID(),
    program_id: detail.program.program_id,
    account_id: detail.program.account_id,
    report_snapshot_id: backingSnapshot?.snapshot_id,
    title: `${detail.program.title} research milestone`,
    status: "active",
    payload: buildProgramReportPayload(detail, now),
    created_at: now,
  };

  await researchProgramRepository.saveProgramReport(report);
  await researchProgramRepository.supersedeProgramReports(report.program_id, report.program_report_snapshot_id);
  await researchProgramRepository.recordEvent({
    event_id: randomUUID(),
    program_id: report.program_id,
    account_id: report.account_id,
    actor_user_id: input.user_id,
    event_type: "report_snapshot_created",
    title: "Program report snapshot created",
    summary: "A program-level research milestone was frozen for sharing, export, and Research Desk review.",
    payload: {
      program_report_snapshot_id: report.program_report_snapshot_id,
      backing_report_snapshot_id: report.report_snapshot_id,
      experiments: report.payload.experiments_run.length,
      hypotheses: report.payload.hypotheses_tested.length,
    },
    created_at: now,
  });
  return report;
}

export async function getProgramReportOwned(reportId: string, accountId: string) {
  const report = await researchProgramRepository.findProgramReport(reportId);
  if (!report || report.account_id !== accountId) return undefined;
  return report;
}

export function renderProgramReport(report: ProgramReportSnapshot, format: ExportFormat) {
  if (format === "json") {
    return {
      bytes: Buffer.from(JSON.stringify(report.payload, null, 2)),
      content_type: "application/json; charset=utf-8",
      file_name: `program-report-${report.program_report_snapshot_id.slice(0, 8)}.json`,
    };
  }
  const md = [
    `# ${report.payload.title}`,
    "",
    `Generated: ${report.payload.generated_at}`,
    "",
    "## Research Question",
    report.payload.research_question.thesis,
    "",
    "## Hypotheses Tested",
    ...(report.payload.hypotheses_tested.length
      ? report.payload.hypotheses_tested.map((item) => `- ${item.title}: ${item.status}. Invalidation: ${item.invalidation_criteria.join("; ") || "not recorded"}`)
      : ["No hypothesis spec has been approved yet."]),
    "",
    "## Experiments Run",
    ...(report.payload.experiments_run.length
      ? report.payload.experiments_run.map((item) => `- ${item.experiment_job_id.slice(0, 8)}: ${item.status}${item.verdict ? `, verdict ${item.verdict}` : ""}${item.recommended_action ? `, next ${item.recommended_action}` : ""}`)
      : ["No experiment run has been recorded yet."]),
    "",
    "## Rejected Variants",
    ...(report.payload.rejected_variants.length ? report.payload.rejected_variants.map((item) => `- ${item.title}: ${item.reason}`) : ["No rejected variant has been recorded yet."]),
    "",
    "## Surviving Candidates",
    ...(report.payload.surviving_candidates.length ? report.payload.surviving_candidates.map((item) => `- ${item.title}: ${item.support}`) : ["No surviving candidate has been promoted yet."]),
    "",
    "## Evidence Limits",
    ...(report.payload.evidence_limits.length ? report.payload.evidence_limits.map((item) => `- ${item}`) : ["No material evidence limit was recorded."]),
    "",
    "## Next Experiment Plan",
    ...(report.payload.next_experiment_plan.length ? report.payload.next_experiment_plan.map((item) => `- ${item}`) : ["No next experiment has been proposed yet."]),
  ].join("\n");
  return {
    bytes: Buffer.from(md),
    content_type: "text/markdown; charset=utf-8",
    file_name: `program-report-${report.program_report_snapshot_id.slice(0, 8)}.md`,
  };
}

export async function createProgramReportShare(input: {
  program_report_snapshot_id: string;
  account_id: string;
  user_id: string;
  expires_at?: string;
}) {
  const report = await getProgramReportOwned(input.program_report_snapshot_id, input.account_id);
  if (!report) throw new Error("program_report_not_found");
  if (report.status !== "active") throw new Error("program_report_not_active");
  await assertProgramShareAllowed(input.account_id);

  const token = randomBytes(32).toString("base64url");
  const now = new Date().toISOString();
  const expiresAt = input.expires_at ?? new Date(Date.now() + DEFAULT_PROGRAM_SHARE_TTL_DAYS * 86_400_000).toISOString();
  const share = await researchProgramRepository.saveProgramReportShare({
    share_id: randomUUID(),
    token_hash: hashShareToken(token),
    program_report_snapshot_id: report.program_report_snapshot_id,
    program_id: report.program_id,
    account_id: report.account_id,
    created_by_user_id: input.user_id,
    status: "active",
    expires_at: expiresAt,
    created_at: now,
    updated_at: now,
  });
  await accountService.incrementUsage(input.account_id, "share");
  return { token, share, url: `/program-share/${token}` };
}

export async function resolveProgramReportShare(input: { token: string }) {
  const share = await researchProgramRepository.findProgramReportShareByTokenHash(hashShareToken(input.token));
  if (!share || share.status !== "active") return undefined;
  if (share.expires_at && share.expires_at <= new Date().toISOString()) return undefined;
  const report = await researchProgramRepository.findProgramReport(share.program_report_snapshot_id);
  if (!report || report.status !== "active") return undefined;
  return { share, report };
}

export async function requestProgramResearchDeskReview(input: {
  program_report_snapshot_id: string;
  account_id: string;
  requested_by_user_id: string;
  user_note?: string;
}) {
  const report = await getProgramReportOwned(input.program_report_snapshot_id, input.account_id);
  if (!report) throw new Error("program_report_not_found");
  if (!report.report_snapshot_id) throw new Error("program_report_requires_audit_import");
  const state = await accountService.getAccountState(input.account_id);
  if (!state?.entitlements.can_request_research_desk) throw new Error("research_desk_plan_restricted");

  const backingSnapshot = await reportSnapshotRepository.findById(report.report_snapshot_id);
  if (!backingSnapshot) throw new Error("backing_report_snapshot_not_found");
  const analysis = await getCoreRepositories().analyses.findById(backingSnapshot.analysis_id);
  if (!analysis || analysis.account_id !== input.account_id) throw new Error("analysis_not_found");

  const requestedServices: ResearchDeskService[] = ["claim_validation", "investor_buyer_memo_review", "data_quality_audit"];
  const packet: ValidationPacketTemplate & { program_packet: ProgramReportPayload } = {
    packet_version: "validation_packet_v2",
    analysis_id: analysis.analysis_id,
    artifact_id: analysis.artifact_id,
    report_snapshot_id: backingSnapshot.snapshot_id,
    strategy_name: report.payload.title,
    generated_at: new Date().toISOString(),
    trigger_limitation: report.payload.evidence_limits[0] ?? "Program-level Research Desk review requested.",
    requested_services: requestedServices,
    requested_questions: [
      "Are the surviving candidates supported by the experiment path?",
      "Which rejected variants should stay rejected?",
      "What evidence is still missing before external capital or deployment decisions?",
    ],
    client_note: input.user_note,
    artifact_manifest: {
      artifact_id: analysis.artifact_id,
      eligibility_summary: {
        accepted: true,
        diagnostics_available: report.payload.imports.map((item) => item.strategy_name),
        diagnostics_limited: [],
        diagnostics_unavailable: report.payload.evidence_limits,
        limitation_reasons: report.payload.evidence_limits,
      },
    },
    evidence_ledger: [],
    assumption_ledger: [],
    unsupported_claims: [],
    diagnostic_outputs: [],
    limitations: report.payload.evidence_limits,
    recommendations: report.payload.next_experiment_plan,
    warnings: report.payload.evidence_limits,
    decision_metrics: [
      { label: "Hypotheses", value: String(report.payload.hypotheses_tested.length) },
      { label: "Experiments", value: String(report.payload.experiments_run.length) },
      { label: "Findings", value: String(report.payload.memory_summary.findings.length) },
    ],
    reviewer_checklist: [
      "Review hypothesis and strategy specs.",
      "Review completed and failed experiment artifacts.",
      "Review verdict cards and memory-derived recommendations.",
      "Attach public addendum only after evidence boundaries are explicit.",
    ],
    program_packet: report.payload,
  };

  const now = new Date().toISOString();
  const request = await researchDeskRepository.saveRequest({
    request_id: randomUUID(),
    report_snapshot_id: backingSnapshot.snapshot_id,
    analysis_id: analysis.analysis_id,
    artifact_id: analysis.artifact_id,
    account_id: input.account_id,
    requested_by_user_id: input.requested_by_user_id,
    trigger_limitation: packet.trigger_limitation,
    requested_services: requestedServices,
    validation_packet: packet,
    status: "received",
    user_note: input.user_note,
    created_at: now,
    updated_at: now,
  });
  await accountService.incrementUsage(input.account_id, "research_desk");
  return { request };
}
