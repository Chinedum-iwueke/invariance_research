import { randomUUID } from "node:crypto";
import type { ExperimentJobRecord } from "@/lib/server/research-programs/models";

export const EXPERIMENT_CARD_BUNDLE_SCHEMA_VERSION = "strategy_research_terminal.bundle.v1";
export const EXPERIMENT_CARD_SCHEMA_VERSION = "strategy_research_terminal.card.v1";

export type ExperimentIntelligenceCard = {
  schema_version: typeof EXPERIMENT_CARD_SCHEMA_VERSION;
  card_type: string;
  card_id: string;
  strategy_spec_id?: string;
  hypothesis_id?: string;
  experiment_plan_id?: string;
  experiment_item_id?: string;
  experiment_type?: string;
  title?: string;
  created_at: string;
  source_artifacts: Record<string, unknown>;
  data: Record<string, unknown>;
  warnings: string[];
};

export type ExperimentCardBundle = {
  schema_version: typeof EXPERIMENT_CARD_BUNDLE_SCHEMA_VERSION;
  card_schema_version: typeof EXPERIMENT_CARD_SCHEMA_VERSION;
  created_at: string;
  cards: ExperimentIntelligenceCard[];
};

export type ExperimentCardSummary = {
  schema_version: string;
  created_at?: string;
  card_count: number;
  verdict?: string;
  confidence?: string;
  decision_grade?: boolean;
  recommended_action?: string;
  warning_count: number;
  cards: Array<{
    card_type: string;
    title?: string;
    summary?: string;
    status?: string;
    warnings: string[];
    data: Record<string, unknown>;
  }>;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asCards(value: unknown): ExperimentIntelligenceCard[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ExperimentIntelligenceCard => {
    const record = asRecord(item);
    return record.schema_version === EXPERIMENT_CARD_SCHEMA_VERSION && typeof record.card_type === "string";
  });
}

function summaryForCard(card: ExperimentIntelligenceCard) {
  const data = asRecord(card.data);
  const summary = data.summary ?? data.reason ?? data.decision_grade_reason ?? data.next_action ?? data.promotion_or_scrap_summary;
  return {
    card_type: card.card_type,
    title: card.title,
    summary: typeof summary === "string" ? summary : undefined,
    status: typeof data.status === "string" ? data.status : typeof data.execution_status === "string" ? data.execution_status : undefined,
    warnings: Array.isArray(card.warnings) ? card.warnings.map(String) : [],
    data,
  };
}

export function summarizeExperimentCardBundle(payload: unknown): ExperimentCardSummary | undefined {
  const root = asRecord(payload);
  const bundle = root.schema_version === EXPERIMENT_CARD_BUNDLE_SCHEMA_VERSION ? root : asRecord(root.cards);
  if (bundle.schema_version !== EXPERIMENT_CARD_BUNDLE_SCHEMA_VERSION) return undefined;
  const cards = asCards(bundle.cards);
  const verdict = cards.find((card) => card.card_type === "VerdictCard");
  const next = cards.find((card) => card.card_type === "NextExperimentCard");
  const verdictData = asRecord(verdict?.data);
  const nextData = asRecord(next?.data);
  return {
    schema_version: String(bundle.schema_version),
    created_at: typeof bundle.created_at === "string" ? bundle.created_at : undefined,
    card_count: cards.length,
    verdict: typeof verdictData.verdict === "string" ? verdictData.verdict : undefined,
    confidence: typeof verdictData.confidence === "string" ? verdictData.confidence : undefined,
    decision_grade: typeof verdictData.decision_grade === "boolean" ? verdictData.decision_grade : undefined,
    recommended_action: typeof nextData.recommended_action === "string" ? nextData.recommended_action : undefined,
    warning_count: cards.reduce((sum, card) => sum + (Array.isArray(card.warnings) ? card.warnings.length : 0), 0),
    cards: cards.map(summaryForCard),
  };
}

function makeFailureCard(input: {
  job: ExperimentJobRecord;
  cardType: "FailureCauseCard" | "VerdictCard" | "NextExperimentCard";
  message: string;
  data: Record<string, unknown>;
}): ExperimentIntelligenceCard {
  const now = new Date().toISOString();
  return {
    schema_version: EXPERIMENT_CARD_SCHEMA_VERSION,
    card_type: input.cardType,
    card_id: randomUUID(),
    experiment_plan_id: input.job.experiment_plan_id,
    experiment_item_id: input.job.experiment_plan_item_id,
    created_at: now,
    source_artifacts: {
      experiment_job_id: input.job.experiment_job_id,
      last_error: "experiment_job.last_error",
    },
    data: input.data,
    warnings: [input.message],
  };
}

export function buildFailureCardBundle(input: { job: ExperimentJobRecord; error: string }): ExperimentCardBundle {
  const message = input.error.slice(0, 2000);
  const cards = [
    makeFailureCard({
      job: input.job,
      cardType: "FailureCauseCard",
      message,
      data: {
        failure_detected: true,
        status: "failed",
        root_cause_hint: message.includes("timeout") ? "timeout" : message.includes("missing") || message.includes("not_found") ? "missing_artifact_or_path" : "execution_error",
        error_message: message,
        summary: "The experiment worker failed before a decision-grade run artifact could be produced.",
      },
    }),
    makeFailureCard({
      job: input.job,
      cardType: "VerdictCard",
      message,
      data: {
        verdict: "execution_failed",
        status: "failed",
        confidence: "not_evaluable",
        decision_grade: false,
        summary: "No strategy verdict is available because execution failed.",
        blocking_gaps: [message],
      },
    }),
    makeFailureCard({
      job: input.job,
      cardType: "NextExperimentCard",
      message,
      data: {
        recommended_action: "repair_execution_failure",
        requires_human_approval: false,
        next_action: "Fix the execution failure, then retry the same approved experiment item.",
      },
    }),
  ];
  return {
    schema_version: EXPERIMENT_CARD_BUNDLE_SCHEMA_VERSION,
    card_schema_version: EXPERIMENT_CARD_SCHEMA_VERSION,
    created_at: new Date().toISOString(),
    cards,
  };
}

export function renderExperimentCardsMarkdown(bundle: ExperimentCardBundle): string {
  const lines = ["# Experiment Verdict Cards", ""];
  for (const card of bundle.cards) {
    const data = asRecord(card.data);
    const summary = data.summary ?? data.reason ?? data.next_action;
    lines.push(`## ${card.card_type}`, "");
    if (typeof data.status === "string") lines.push(`- Status: \`${data.status}\``);
    if (typeof data.verdict === "string") lines.push(`- Verdict: \`${data.verdict}\``);
    if (typeof data.recommended_action === "string") lines.push(`- Recommended action: \`${data.recommended_action}\``);
    if (summary) lines.push(`- Summary: ${String(summary)}`);
    if (card.warnings.length) lines.push(`- Warnings: ${card.warnings.length}`);
    lines.push("");
  }
  return `${lines.join("\n").trim()}\n`;
}
