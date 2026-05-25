import type { EvidenceEventRecord } from "@/lib/server/evidence/evidence-events";
import type { AnalysisRecord } from "@/lib/contracts";
import type { AnalysisEntity } from "@/lib/server/analysis/models";
import type { ReportSnapshotRecord } from "@/lib/server/exports/models";
import type { ExportRecord } from "@/lib/server/exports/models";
import type { ShareAccessEvent, ShareTokenRecord } from "@/lib/server/share/models";

export type ValidationCommandKind = "navigate" | "api" | "blocked";
export type ValidationCommandTone = "primary" | "neutral" | "warning";

export type ValidationCommand = {
  id: string;
  label: string;
  description: string;
  kind: ValidationCommandKind;
  tone: ValidationCommandTone;
  href?: string;
  method?: "GET" | "POST" | "DELETE";
  endpoint?: string;
  body?: Record<string, unknown>;
  blocked_reason?: string;
  evidence_aware: boolean;
  plan_aware: boolean;
  redaction_aware: boolean;
};

export type SavedValidationQuestion = {
  id: string;
  question: string;
  answer: string;
  command_id?: string;
  severity: "info" | "warning" | "critical";
};

export type ValidationExplanation = {
  id: string;
  question: string;
  answer: string;
  reason_codes: string[];
  next_evidence: string[];
  redaction_safe: true;
};

export type CaseFileTimelineEvent = {
  id: string;
  event_type: string;
  title: string;
  summary: string;
  severity: "info" | "warning" | "critical";
  created_at: string;
  href?: string;
};

export type ValidationCommandLayer = {
  schema_version: "validation_command_layer_v1";
  analysis_id: string;
  snapshot_id?: string;
  commands: ValidationCommand[];
  saved_questions: SavedValidationQuestion[];
  alerts: CaseFileTimelineEvent[];
  timeline: CaseFileTimelineEvent[];
  explanations: ValidationExplanation[];
};

export function buildValidationCommandLayer(input: {
  analysis: AnalysisEntity;
  record?: AnalysisRecord;
  activeSnapshot?: ReportSnapshotRecord;
  snapshots?: ReportSnapshotRecord[];
  exports?: ExportRecord[];
  shares?: ShareTokenRecord[];
  shareEvents?: ShareAccessEvent[];
  evidenceEvents?: EvidenceEventRecord[];
}): ValidationCommandLayer {
  const { analysis, record, activeSnapshot } = input;
  const completed = analysis.status === "completed" && Boolean(record);
  const baseHref = `/app/analyses/${analysis.analysis_id}`;
  const snapshotId = activeSnapshot?.snapshot_id;
  const commands: ValidationCommand[] = [
    navCommand("explain_verdict", "Explain verdict", "Open the verdict explanation and the evidence limits behind it.", `${baseHref}/report#explain-verdict`, completed),
    navCommand("show_missing_evidence", "Show missing evidence", "Jump to the evidence rail and next-evidence requests.", `${baseHref}/assumptions#missing-evidence`, completed),
    navCommand("open_assumptions", "Open Assumption Ledger", "Review material assumptions and rescue evidence.", `${baseHref}/assumptions`, completed),
    navCommand("open_unsupported_claims", "Open unsupported claims", "Inspect claims the artifact does not yet prove.", `${baseHref}/assumptions#unsupported-claims`, completed),
    navCommand("open_prop_evaluation", "Open Prop Evaluation", "Review pass readiness, breach risk, and prop-rule improvement targets.", `${baseHref}/prop-evaluation`, completed && Boolean(record?.access.can_view_prop_evaluation), "Prop evaluation readiness is not available for this analysis."),
    apiCommand("recompute_prop_evaluation", "Recompute prop evaluation", "Re-run prop feasibility using the saved or default rule profile.", `/api/analyses/${analysis.analysis_id}/prop-evaluation`, "POST", completed && Boolean(record?.access.can_view_prop_evaluation), "Prop evaluation readiness is not available for this analysis."),
    navCommand("open_report_snapshot", "Open report snapshot", "Review the current immutable-style proof report state.", `${baseHref}/report`, completed && Boolean(snapshotId), "Generate a report snapshot first."),
    apiCommand("generate_snapshot", "Generate report snapshot", "Create or refresh the active proof-report snapshot.", `/api/analyses/${analysis.analysis_id}/report-snapshot`, "POST", completed),
    apiCommand("export_pdf", "Export PDF", "Queue a PDF validation memo export.", `/api/analyses/${analysis.analysis_id}/exports`, "POST", completed && Boolean(record?.access.can_export_report), record?.access.can_export_report ? undefined : "Current plan cannot export reports.", { format: "pdf" }),
    apiCommand("export_markdown", "Export Markdown", "Queue a Markdown validation memo export.", `/api/analyses/${analysis.analysis_id}/exports`, "POST", completed && Boolean(record?.access.can_export_report), record?.access.can_export_report ? undefined : "Current plan cannot export reports.", { format: "md" }),
    apiCommand("export_json", "Export JSON", "Queue a JSON validation memo export.", `/api/analyses/${analysis.analysis_id}/exports`, "POST", completed && Boolean(record?.access.can_export_report), record?.access.can_export_report ? undefined : "Current plan cannot export reports.", { format: "json" }),
    apiCommand("create_share_link", "Create share link", "Create a recipient-safe Share Room link from the active snapshot.", snapshotId ? `/api/report-snapshots/${snapshotId}/shares` : "", "POST", completed && Boolean(snapshotId), "Generate a report snapshot before sharing."),
    navCommand("request_research_desk", "Request Research Desk review", "Create a deeper review packet from a specific limitation.", `${baseHref}/report#research-desk`, completed),
    navCommand("show_artifact_blocks", "Show artifact-blocked diagnostics", "See diagnostics blocked because the artifact is incomplete.", `${baseHref}/overview#diagnostic-coverage`, completed),
    navCommand("show_plan_blocks", "Show plan-blocked diagnostics", "Separate subscription limits from evidence limits.", `${baseHref}/overview#diagnostic-coverage`, completed),
    blockedCommand("compare_previous_run", "Compare previous run", "Compare this report against prior strategy lineage.", "Strategy lineage is not attached to this analysis yet."),
  ];

  const explanations = buildExplanations(record, activeSnapshot);
  return {
    schema_version: "validation_command_layer_v1",
    analysis_id: analysis.analysis_id,
    snapshot_id: snapshotId,
    commands,
    saved_questions: buildSavedQuestions(explanations),
    alerts: buildAlerts(input),
    timeline: buildTimeline(input),
    explanations,
  };
}

function navCommand(id: string, label: string, description: string, href: string, enabled: boolean, blockedReason = "Analysis must complete before this command is available."): ValidationCommand {
  return enabled
    ? { id, label, description, kind: "navigate", tone: "neutral", href, evidence_aware: true, plan_aware: true, redaction_aware: true }
    : blockedCommand(id, label, description, blockedReason);
}

function apiCommand(
  id: string,
  label: string,
  description: string,
  endpoint: string,
  method: "POST" | "DELETE",
  enabled: boolean,
  blockedReason = "Analysis must complete before this command is available.",
  body?: Record<string, unknown>,
): ValidationCommand {
  return enabled
    ? { id, label, description, kind: "api", tone: id.includes("export") || id.includes("share") ? "primary" : "neutral", endpoint, method, body, evidence_aware: true, plan_aware: true, redaction_aware: true }
    : blockedCommand(id, label, description, blockedReason);
}

function blockedCommand(id: string, label: string, description: string, blockedReason: string): ValidationCommand {
  return { id, label, description, kind: "blocked", tone: "warning", blocked_reason: blockedReason, evidence_aware: true, plan_aware: true, redaction_aware: true };
}

function buildExplanations(record: AnalysisRecord | undefined, snapshot: ReportSnapshotRecord | undefined): ValidationExplanation[] {
  if (!record) {
    return [{
      id: "analysis_not_completed",
      question: "Why are commands limited?",
      answer: "The analysis has not completed, so the validation layer cannot yet bind actions to a verdict, diagnostic state, or report snapshot.",
      reason_codes: ["analysis.not_completed"],
      next_evidence: ["Wait for the analysis worker to complete or retry the failed run."],
      redaction_safe: true,
    }];
  }

  const proof = record.proof_report;
  const verdict = proof?.executive_verdict?.taxonomy ?? record.summary.headline_verdict.status;
  const limitation = firstString([
    ...(proof?.limitations ?? []),
    ...record.report.limitations,
    ...record.summary.warnings.map((warning) => warning.message),
  ], "No explicit report limitation was emitted.");
  const nextEvidence = proof?.next_evidence?.length ? proof.next_evidence : ["Attach richer trade, execution, market-context, or parameter evidence if the current diagnostic is limited."];
  const unsupported = (record.claim_inventory ?? []).filter((claim) => ["unsupported", "contradicted", "outside_scope"].includes(claim.support_status));
  const changed = snapshot
    ? `The active snapshot ${snapshot.snapshot_id.slice(0, 8)} was generated from checksum ${snapshot.source_result_checksum.slice(0, 10)}. A stale warning appears if the analysis result changes after this snapshot.`
    : "No report snapshot exists yet. Generate one before sharing or exporting a fixed memo.";

  return [
    {
      id: "why_verdict",
      question: "Why this verdict?",
      answer: `The report verdict is ${String(verdict).replaceAll("_", " ")} because the available diagnostics, limitations, and unsupported claims were mapped into the Strategy Truth Room taxonomy. ${record.summary.headline_verdict.summary}`,
      reason_codes: ["verdict.taxonomy", `verdict.${String(verdict)}`],
      next_evidence: nextEvidence.slice(0, 5),
      redaction_safe: true,
    },
    {
      id: "why_limited",
      question: "Why is this diagnostic limited?",
      answer: limitation,
      reason_codes: limitedReasonCodes(record),
      next_evidence: nextEvidence.slice(0, 5),
      redaction_safe: true,
    },
    {
      id: "what_unlocks",
      question: "What input unlocks more diagnostics?",
      answer: nextEvidence[0] ?? "Provide richer source artifacts aligned to the diagnostic you want to unlock.",
      reason_codes: ["evidence.next_required"],
      next_evidence: nextEvidence.slice(0, 7),
      redaction_safe: true,
    },
    {
      id: "what_changed",
      question: "What changed since the previous snapshot?",
      answer: changed,
      reason_codes: ["snapshot.identity", snapshot ? `snapshot.${snapshot.status}` : "snapshot.missing"],
      next_evidence: snapshot ? [] : ["Generate a report snapshot before creating a share room."],
      redaction_safe: true,
    },
    {
      id: "rescue_claim",
      question: "What evidence would rescue a weak or unsupported claim?",
      answer: unsupported.length
        ? `${unsupported[0].claim}: ${(unsupported[0].missing_evidence ?? []).join(", ") || "explicit source evidence is required."}`
        : "No unsupported claim was emitted. Stronger broker, market-context, and parameter-sweep evidence can still raise report confidence.",
      reason_codes: unsupported.length ? unsupported.map((claim) => `claim.${claim.support_status}`) : ["claim.none_unsupported"],
      next_evidence: unsupported.flatMap((claim) => claim.missing_evidence ?? []).slice(0, 7),
      redaction_safe: true,
    },
  ];
}

function buildSavedQuestions(explanations: ValidationExplanation[]): SavedValidationQuestion[] {
  const byId = new Map(explanations.map((item) => [item.id, item]));
  return [
    question("assumptions", "What assumptions produced this result?", byId.get("why_limited"), "open_assumptions"),
    question("worse_fills", "What happens if fills get worse?", byId.get("what_unlocks"), "show_missing_evidence"),
    question("fee_change", "What happens if fees change?", byId.get("what_unlocks"), "show_missing_evidence"),
    question("regime_failure", "Where does this strategy fail by regime?", byId.get("why_limited"), "show_artifact_blocks"),
    question("prop_contract", "Would this strategy breach my prop evaluation rules?", byId.get("what_unlocks"), "open_prop_evaluation"),
    question("rare_trades", "How much edge comes from rare trades?", byId.get("why_verdict"), "explain_verdict"),
    question("missing_evidence", "What evidence is missing?", byId.get("what_unlocks"), "show_missing_evidence"),
    question("does_not_prove", "What does this report not prove?", byId.get("rescue_claim"), "open_unsupported_claims"),
  ];
}

function question(id: string, questionText: string, explanation: ValidationExplanation | undefined, commandId: string): SavedValidationQuestion {
  return {
    id,
    question: questionText,
    answer: explanation?.answer ?? "The analysis must complete before this question can be answered.",
    command_id: commandId,
    severity: explanation?.next_evidence.length ? "warning" : "info",
  };
}

function buildAlerts(input: {
  record?: AnalysisRecord;
  activeSnapshot?: ReportSnapshotRecord;
  exports?: ExportRecord[];
  shares?: ShareTokenRecord[];
  shareEvents?: ShareAccessEvent[];
  evidenceEvents?: EvidenceEventRecord[];
}): CaseFileTimelineEvent[] {
  const persisted = (input.evidenceEvents ?? [])
    .filter((event) => event.event_type !== "upload_accepted" && event.event_type !== "analysis_queued")
    .map(eventToTimeline);
  const derived: CaseFileTimelineEvent[] = [];
  if (input.activeSnapshot?.status === "superseded") {
    derived.push({
      id: `snapshot-superseded-${input.activeSnapshot.snapshot_id}`,
      event_type: "snapshot_superseded",
      title: "Snapshot superseded",
      summary: "A newer report snapshot should be used before sharing this memo.",
      severity: "warning",
      created_at: input.activeSnapshot.superseded_at ?? input.activeSnapshot.created_at,
    });
  }
  for (const exportRecord of input.exports ?? []) {
    if (exportRecord.status === "failed") {
      derived.push({
        id: `export-failed-${exportRecord.export_id}`,
        event_type: "export_failed",
        title: "Export failed",
        summary: exportRecord.error_message ?? "The export worker failed to render the report artifact.",
        severity: "warning",
        created_at: exportRecord.updated_at,
      });
    }
  }
  return uniqueTimeline([...persisted, ...derived]).slice(0, 12);
}

function buildTimeline(input: {
  analysis: AnalysisEntity;
  record?: AnalysisRecord;
  activeSnapshot?: ReportSnapshotRecord;
  snapshots?: ReportSnapshotRecord[];
  exports?: ExportRecord[];
  shares?: ShareTokenRecord[];
  shareEvents?: ShareAccessEvent[];
  evidenceEvents?: EvidenceEventRecord[];
}): CaseFileTimelineEvent[] {
  const base: CaseFileTimelineEvent[] = [
    {
      id: `analysis-created-${input.analysis.analysis_id}`,
      event_type: "analysis_queued",
      title: "Analysis created",
      summary: `Analysis entered the validation workflow with status ${input.analysis.status}.`,
      severity: input.analysis.status === "failed" ? "critical" : "info",
      created_at: input.analysis.created_at,
    },
  ];

  if (input.analysis.eligibility_snapshot) {
    base.push({
      id: `artifact-classified-${input.analysis.analysis_id}`,
      event_type: "artifact_classified",
      title: "Artifact classified",
      summary: input.analysis.eligibility_snapshot.summary_text,
      severity: input.analysis.eligibility_snapshot.accepted ? "info" : "warning",
      created_at: input.analysis.created_at,
    });
  }
  if (input.record) {
    base.push({
      id: `verdict-${input.analysis.analysis_id}`,
      event_type: "verdict_generated",
      title: "Verdict generated",
      summary: input.record.summary.headline_verdict.summary,
      severity: input.record.summary.headline_verdict.status === "fragile" ? "warning" : "info",
      created_at: input.analysis.updated_at,
      href: `/app/analyses/${input.analysis.analysis_id}/report#explain-verdict`,
    });
  }
  for (const snapshot of input.snapshots ?? []) {
    base.push({
      id: `snapshot-${snapshot.snapshot_id}`,
      event_type: snapshot.status === "superseded" ? "snapshot_superseded" : "snapshot_generated",
      title: snapshot.status === "superseded" ? "Snapshot superseded" : "Snapshot generated",
      summary: `${snapshot.payload.included_diagnostics.length} diagnostics included; ${snapshot.payload.excluded_diagnostics.length} excluded.`,
      severity: snapshot.status === "superseded" ? "warning" : "info",
      created_at: snapshot.superseded_at ?? snapshot.created_at,
      href: `/app/analyses/${snapshot.analysis_id}/report`,
    });
  }
  for (const exportRecord of input.exports ?? []) {
    base.push({
      id: `export-${exportRecord.export_id}`,
      event_type: `export_${exportRecord.status}`,
      title: `Export ${exportRecord.status}`,
      summary: `${exportRecord.format.toUpperCase()} export ${exportRecord.status}.`,
      severity: exportRecord.status === "failed" ? "warning" : "info",
      created_at: exportRecord.updated_at,
    });
  }
  for (const share of input.shares ?? []) {
    base.push({
      id: `share-${share.share_id}`,
      event_type: share.status === "revoked" ? "share_revoked" : "share_created",
      title: share.status === "revoked" ? "Share revoked" : "Share created",
      summary: share.status === "revoked" ? "Recipient access fails closed." : "Recipient-safe Share Room link was created.",
      severity: share.status === "revoked" ? "warning" : "info",
      created_at: share.revoked_at ?? share.created_at,
    });
  }
  for (const event of input.shareEvents ?? []) {
    base.push({
      id: `share-access-${event.event_id}`,
      event_type: `share_${event.outcome}`,
      title: `Share ${event.outcome}`,
      summary: "Share Room access event was recorded without exposing raw requester details.",
      severity: event.outcome === "viewed" ? "info" : "warning",
      created_at: event.created_at,
    });
  }
  return uniqueTimeline([...(input.evidenceEvents ?? []).map(eventToTimeline), ...base]).slice(0, 30);
}

function eventToTimeline(event: EvidenceEventRecord): CaseFileTimelineEvent {
  return {
    id: event.event_id,
    event_type: event.event_type,
    title: event.title,
    summary: event.summary,
    severity: event.severity,
    created_at: event.created_at,
  };
}

function uniqueTimeline(events: CaseFileTimelineEvent[]): CaseFileTimelineEvent[] {
  const seen = new Set<string>();
  return events
    .filter((event) => {
      const key = `${event.event_type}:${event.title}:${event.summary}:${event.created_at}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

function limitedReasonCodes(record: AnalysisRecord): string[] {
  return Object.entries(record.diagnostic_statuses)
    .filter(([, status]) => status.status !== "available")
    .map(([diagnostic, status]) => `${diagnostic}.${status.status}`);
}

function firstString(values: unknown[], fallback: string): string {
  const found = values.find((value): value is string => typeof value === "string" && value.trim().length > 0);
  return found ?? fallback;
}
