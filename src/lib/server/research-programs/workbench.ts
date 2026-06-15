import type { ProgramDetail, ExperimentJobEventRecord } from "@/lib/server/research-programs/models";

export type ProgramWorkbenchSummary = {
  thesis: string;
  next_action: string;
  active_hypotheses: number;
  approved_hypotheses: number;
  approved_strategy_specs: number;
  queued_or_running_experiments: number;
  completed_experiments: number;
  failed_experiments: number;
  latest_verdict?: {
    verdict?: string;
    confidence?: string;
    decision_grade?: boolean;
    recommended_action?: string;
    event_id: string;
    created_at: string;
  };
  promoted_or_completed_recommendations: number;
  dismissed_recommendations: number;
  memory_items: number;
  findings: number;
  similar_signatures: number;
  command_states: {
    can_create_hypothesis: boolean;
    can_queue_next_experiment: boolean;
    can_explain_failure: boolean;
    can_find_similar_runs: boolean;
    can_generate_report: boolean;
    can_request_research_desk: boolean;
  };
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function latestVerdictEvent(events: ExperimentJobEventRecord[]) {
  for (const event of events) {
    const summary = asRecord(asRecord(event.payload).card_summary);
    if (summary.card_count) {
      return {
        verdict: typeof summary.verdict === "string" ? summary.verdict : undefined,
        confidence: typeof summary.confidence === "string" ? summary.confidence : undefined,
        decision_grade: typeof summary.decision_grade === "boolean" ? summary.decision_grade : undefined,
        recommended_action: typeof summary.recommended_action === "string" ? summary.recommended_action : undefined,
        event_id: event.experiment_job_event_id,
        created_at: event.created_at,
      };
    }
  }
  return undefined;
}

export function buildProgramWorkbenchSummary(detail: ProgramDetail): ProgramWorkbenchSummary {
  const queuedOrRunning = detail.experiment_jobs.filter((job) => job.status === "queued" || job.status === "processing").length;
  const failedExperiments = detail.experiment_jobs.filter((job) => job.status === "failed").length;
  const completedExperiments = detail.experiment_jobs.filter((job) => job.status === "completed").length;
  const approvedStrategies = detail.strategy_specs.filter((spec) => spec.status === "approved_for_execution" && spec.validation_errors.length === 0).length;
  const approvedHypotheses = detail.hypothesis_versions.filter((hypothesis) => hypothesis.status === "approved_for_strategy_generation" && hypothesis.validation_errors.length === 0).length;
  const approvedPlans = detail.experiment_plans.filter((plan) => plan.status === "approved").length;
  const latestVerdict = latestVerdictEvent(detail.experiment_job_events);
  const promoted = detail.memory.recommendations.filter((rec) => rec.status === "completed" || rec.status === "accepted").length;
  const dismissed = detail.memory.recommendations.filter((rec) => rec.status === "dismissed").length;

  return {
    thesis: detail.program.thesis,
    next_action: detail.program.next_action,
    active_hypotheses: detail.hypothesis_versions.length,
    approved_hypotheses: approvedHypotheses,
    approved_strategy_specs: approvedStrategies,
    queued_or_running_experiments: queuedOrRunning,
    completed_experiments: completedExperiments,
    failed_experiments: failedExperiments,
    latest_verdict: latestVerdict,
    promoted_or_completed_recommendations: promoted,
    dismissed_recommendations: dismissed,
    memory_items: detail.memory.items.length,
    findings: detail.memory.findings.length,
    similar_signatures: detail.memory.similar_runs.length,
    command_states: {
      can_create_hypothesis: detail.research_briefs.length > 0,
      can_queue_next_experiment: approvedPlans > 0 || detail.experiment_plans.some((plan) => plan.status === "queued"),
      can_explain_failure: failedExperiments > 0 || detail.memory.findings.some((finding) => finding.severity === "critical"),
      can_find_similar_runs: detail.memory.similar_runs.length > 0,
      can_generate_report: Boolean(latestVerdict) || completedExperiments > 0 || detail.analyses.length > 0,
      can_request_research_desk: Boolean(latestVerdict) || failedExperiments > 0 || detail.memory.recommendations.length > 0,
    },
  };
}
