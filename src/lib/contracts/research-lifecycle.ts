import { createHash } from "node:crypto";

export const RESEARCH_LIFECYCLE_VERSION = "research_lifecycle_event_v1" as const;
export const RESEARCH_STAGES = ["backtest", "demo", "live_canary", "live"] as const;
export const RESEARCH_EVENT_TYPES = [
  "deployment", "connector", "signal_decision", "order", "fill", "position", "portfolio",
  "trade_episode", "state_snapshot", "incident", "memory_assessment", "promotion", "conversation",
  "source", "citation", "candidate_hypothesis", "hypothesis_card", "proposal", "confirmation",
  "context_snapshot", "assistant_tool_call", "pine_export", "pine_import", "pine_parity",
  "tradingview_observation",
] as const;
const PAYLOAD_REQUIRED: Partial<Record<ResearchEventType, string[]>> = {
  deployment: ["deployment_id", "connector_id", "mode", "status"], connector: ["connector_id", "exchange", "environment", "status"],
  signal_decision: ["symbol", "decision", "state_snapshot_id"], order: ["order_id", "symbol", "side", "status"], fill: ["fill_id", "order_id", "symbol", "price", "quantity"],
  position: ["symbol", "quantity", "mark_price"], portfolio: ["equity", "cash", "gross_exposure"], trade_episode: ["trade_id", "symbol", "opened_at", "status"],
  state_snapshot: ["state_snapshot_id", "features"], incident: ["incident_id", "severity", "summary"], memory_assessment: ["memory_item_id", "assessment", "confidence"],
  promotion: ["from_stage", "to_stage", "decision", "evidence_hash"], conversation: ["conversation_id", "message_id"], source: ["source_id", "checksum_sha256"], citation: ["source_id", "anchor"],
  candidate_hypothesis: ["proposal_id", "claim"], hypothesis_card: ["card_record_id", "card_id", "version", "status"], proposal: ["proposal_id", "proposal_type", "status"],
  confirmation: ["object_type", "object_id"], context_snapshot: ["context_snapshot_id", "included_object_ids"], assistant_tool_call: ["tool_call_id", "tool_name", "authorization_decision", "status"],
  pine_export: ["script_hash", "strategy_spec_hash", "pine_version", "compatibility", "parity_status", "observation_only"], pine_import: ["script_hash", "pine_version", "compatibility", "observation_only"],
  pine_parity: ["script_hash", "strategy_spec_hash", "parity_status", "comparison_artifact_hash"], tradingview_observation: ["script_hash", "observed_at", "symbol", "timeframe", "observation_only"],
};

export type ResearchStage = typeof RESEARCH_STAGES[number];
export type ResearchEventType = typeof RESEARCH_EVENT_TYPES[number];
export type StageIdentity = {
  program_id: string;
  account_id: string;
  stage: ResearchStage;
  strategy_spec_hash: string;
  code_hash: string;
  data_snapshot_id: string;
  deployment_id?: string;
  run_id?: string;
  connector_id?: string;
};
export type ResearchLifecycleEvent = {
  schema_version: typeof RESEARCH_LIFECYCLE_VERSION;
  event_id: string;
  event_type: ResearchEventType;
  occurred_at: string;
  identity: StageIdentity;
  payload: Record<string, unknown>;
  actor: { type: "user" | "assistant" | "worker" | "engine" | "exchange"; id: string };
  event_hash?: string;
};

export type PineLifecyclePayload = {
  script_hash: string;
  strategy_spec_hash: string;
  pine_version: "v5" | "v6";
  compatibility: "visualization_only" | "signal_compatible" | "unsupported";
  unsupported_semantics: string[];
  parity_status: "not_run" | "pass" | "fail" | "not_applicable";
  observation_only: boolean;
};

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

export function hashLifecycleEvent(event: Omit<ResearchLifecycleEvent, "event_hash">) {
  return createHash("sha256").update(canonical(event)).digest("hex");
}

export function validateResearchLifecycleEvent(event: ResearchLifecycleEvent): string[] {
  const errors: string[] = [];
  if (event.schema_version !== RESEARCH_LIFECYCLE_VERSION) errors.push("lifecycle_schema_version_invalid");
  if (!RESEARCH_EVENT_TYPES.includes(event.event_type)) errors.push("lifecycle_event_type_invalid");
  for (const key of ["event_id", "occurred_at"] as const) if (!event[key]) errors.push(`lifecycle_missing_${key}`);
  for (const key of ["program_id", "account_id", "stage", "strategy_spec_hash", "code_hash", "data_snapshot_id"] as const) if (!event.identity?.[key]) errors.push(`stage_identity_missing_${key}`);
  if (!RESEARCH_STAGES.includes(event.identity?.stage)) errors.push("stage_identity_stage_invalid");
  if (["demo", "live_canary", "live"].includes(event.identity?.stage) && !event.identity?.deployment_id) errors.push("stage_identity_deployment_id_required");
  if (!event.actor?.id || !["user", "assistant", "worker", "engine", "exchange"].includes(event.actor?.type)) errors.push("lifecycle_actor_invalid");
  for (const key of PAYLOAD_REQUIRED[event.event_type] ?? []) if (event.payload?.[key] === undefined || event.payload?.[key] === null || event.payload?.[key] === "") errors.push(`lifecycle_payload_missing_${key}`);
  return errors;
}
