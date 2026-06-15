import { createHash } from "node:crypto";
import type { ExperimentJobEventRecord } from "@/lib/server/research-programs/models";
import { researchMemoryRepository } from "@/lib/server/research-memory/repository";
import type {
  ProgramRecommendation,
  ResearchFinding,
  ResearchMemoryItem,
  ResearchMemorySnapshot,
  SimilarRunIndexEntry,
} from "@/lib/server/research-memory/models";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stableId(prefix: string, ...parts: Array<string | undefined>) {
  const digest = createHash("sha256").update(parts.filter(Boolean).join(":")).digest("hex").slice(0, 24);
  return `${prefix}_${digest}`;
}

function clampConfidence(value: unknown, fallback = 0.4) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.min(1, value));
  if (value === "protocol_validated") return 0.55;
  if (value === "not_evaluable") return 0.15;
  return fallback;
}

function memoryTypeFor(cardType: string): ResearchMemoryItem["memory_type"] | undefined {
  const map: Record<string, ResearchMemoryItem["memory_type"]> = {
    VerdictCard: "verdict",
    FailureCauseCard: "failure",
    NextExperimentCard: "next_experiment",
    RunQualityCard: "run_quality",
    ExecutionDragCard: "execution_drag",
    RegimeStateDependencyCard: "state_dependency",
    RegimeDependencyCard: "state_dependency",
    ParameterFragilityCard: "parameter_fragility",
    NullComparisonCard: "null_comparison",
  };
  return map[cardType];
}

function text(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function extractCards(event: ExperimentJobEventRecord) {
  const summary = asRecord(asRecord(event.payload).card_summary);
  const cards = Array.isArray(summary.cards) ? summary.cards.map(asRecord) : [];
  return { summary, cards };
}

function tagsFor(cardType: string, data: Record<string, unknown>, summary: Record<string, unknown>) {
  return [
    cardType,
    text(data.status, ""),
    text(data.verdict, ""),
    text(summary.verdict, ""),
    text(summary.recommended_action, ""),
  ].filter(Boolean).map((item) => item.toLowerCase().replace(/\s+/g, "_"));
}

export function deriveMemoryFromExperimentEvent(event: ExperimentJobEventRecord): {
  items: ResearchMemoryItem[];
  findings: ResearchFinding[];
  recommendations: ProgramRecommendation[];
  similar: SimilarRunIndexEntry[];
} {
  const { summary, cards } = extractCards(event);
  if (!cards.length) return { items: [], findings: [], recommendations: [], similar: [] };

  const now = new Date().toISOString();
  const experimentJobId = event.experiment_job_id;
  const items: ResearchMemoryItem[] = [];
  const findings: ResearchFinding[] = [];
  const recommendations: ProgramRecommendation[] = [];
  const similar: SimilarRunIndexEntry[] = [];

  for (const card of cards) {
    const cardType = text(card.card_type, "UnknownCard");
    const memoryType = memoryTypeFor(cardType);
    if (!memoryType) continue;
    const data = asRecord(card.data);
    const itemId = stableId("mem", event.experiment_job_event_id, cardType);
    const status = text(data.status ?? data.verdict ?? data.recommended_action ?? summary.verdict, "recorded");
    const item: ResearchMemoryItem = {
      memory_item_id: itemId,
      account_id: event.account_id,
      program_id: event.program_id,
      experiment_job_id: experimentJobId,
      memory_type: memoryType,
      title: cardType.replace(/([a-z])([A-Z])/g, "$1 $2"),
      summary: text(data.summary ?? data.reason ?? data.decision_grade_reason ?? data.next_action, event.message),
      status,
      confidence: clampConfidence(data.confidence ?? summary.confidence),
      source_event_id: event.experiment_job_event_id,
      source_card_type: cardType,
      source: { event_id: event.experiment_job_event_id, card },
      tags: tagsFor(cardType, data, summary),
      created_at: event.created_at,
      updated_at: now,
    };
    items.push(item);

    if (cardType === "VerdictCard" || cardType === "FailureCauseCard") {
      findings.push({
        finding_id: stableId("finding", event.experiment_job_event_id, cardType),
        account_id: event.account_id,
        program_id: event.program_id,
        memory_item_id: itemId,
        finding_type: memoryType,
        headline: cardType === "FailureCauseCard" ? "Execution failure finding" : "Verdict finding",
        detail: item.summary,
        severity: status === "failed" || status === "execution_failed" ? "critical" : item.confidence < 0.4 ? "warning" : "info",
        evidence: { event_id: event.experiment_job_event_id, experiment_job_id: experimentJobId, data },
        created_at: event.created_at,
      });
    }

    if (cardType === "NextExperimentCard") {
      recommendations.push({
        recommendation_id: stableId("rec", event.experiment_job_event_id, cardType),
        account_id: event.account_id,
        program_id: event.program_id,
        experiment_job_id: experimentJobId,
        recommendation_type: text(data.recommended_action, "review_next_experiment"),
        recommendation: text(data.next_action ?? data.summary, "Review the next experiment card before queueing more work."),
        status: "proposed",
        confidence: clampConfidence(summary.confidence, 0.45),
        evidence: { event_id: event.experiment_job_event_id, experiment_job_id: experimentJobId, data },
        created_at: event.created_at,
        updated_at: now,
      });
    }
  }

  const signature = [
    text(summary.verdict, "unknown"),
    text(summary.recommended_action, "unknown"),
    String(summary.decision_grade === true),
  ].join("|");
  const verdictItem = items.find((item) => item.memory_type === "verdict") ?? items[0];
  if (verdictItem) {
    similar.push({
      similar_run_index_id: stableId("sim", event.experiment_job_event_id, signature),
      account_id: event.account_id,
      program_id: event.program_id,
      experiment_job_id: experimentJobId,
      signature,
      features: {
        verdict: summary.verdict,
        recommended_action: summary.recommended_action,
        decision_grade: summary.decision_grade,
        warning_count: summary.warning_count,
        card_count: summary.card_count,
      },
      source_memory_item_id: verdictItem.memory_item_id,
      created_at: event.created_at,
    });
  }

  return { items, findings, recommendations, similar };
}

export async function ingestExperimentEventIntoMemory(event: ExperimentJobEventRecord) {
  const batch = deriveMemoryFromExperimentEvent(event);
  await researchMemoryRepository.saveBatch({ ...batch, links: [] });
  return batch;
}

export async function listResearchMemory(accountId: string, programId?: string): Promise<ResearchMemorySnapshot> {
  return researchMemoryRepository.listSnapshot(accountId, programId);
}

export async function searchResearchMemory(accountId: string, query: string) {
  return researchMemoryRepository.search(accountId, query);
}

export function emptyResearchMemorySnapshot(): ResearchMemorySnapshot {
  return { items: [], findings: [], recommendations: [], similar_runs: [] };
}
