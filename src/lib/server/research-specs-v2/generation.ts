import { createHash } from "node:crypto";
import { stringify as toYaml } from "yaml";
import type { CandidateHypothesisPayload, ResearchProposal } from "@/lib/server/research-copilot/models";
import { ENGINE_TRUTH_CONTRACT, EXACT_EXECUTION_SEMANTICS, RESEARCH_GENERATION_POLICY_VERSION } from "@/lib/server/research-specs-v2/generation-policy";
import type { CompileReadinessReport, HypothesisCardV1 } from "@/lib/server/research-specs-v2/models";

export const COMPILER_VERSION = "research_graph_compiler_v1";
const DATASETS = new Set(["ohlcv", "trades", "funding", "open_interest", "mark_price", "index_price", "liquidations", "benchmark", "research_panel"]);
const PORTABLE_TRANSFORMS = new Set(["identity", "sma", "ema", "atr", "true_range", "return", "zscore", "percentile_rank", "half_range_over_close", "true_range_over"]);
const PORTABLE_OPS = new Set([">", ">=", "<", "<=", "=="]);
const REGISTERED_GENERATION_ADAPTERS = new Set(["l7_h1_csi_gated_displacement_trend"]);

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => item === undefined ? "null" : canonical(item)).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
}
export function canonicalHash(value: unknown) { return createHash("sha256").update(canonical(value)).digest("hex"); }

function normalizedDataset(value: string) {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");
  if (normalized === "fees_and_execution_assumptions") return "ohlcv";
  return normalized;
}

export function buildDraftCardFromProposal(input: { proposal: ResearchProposal; programId: string; userId: string; now: string }): HypothesisCardV1 {
  const candidate = input.proposal.payload as CandidateHypothesisPayload & { hypothesis_card?: HypothesisCardV1 };
  if (candidate.hypothesis_card?.schema_version === "hypothesis_card_v1") {
    return { ...candidate.hypothesis_card, card_id: candidate.hypothesis_card.card_id || crypto.randomUUID(), program_id: input.programId, version: 1, status: "draft", confirmed_at: undefined, confirmed_by: undefined };
  }
  const data = [...new Set((candidate.required_datasets ?? ["ohlcv"]).map(normalizedDataset).filter((item) => DATASETS.has(item)))];
  const sourceIds = [...new Set((candidate.source_citations ?? []).map((item) => item.source_id))];
  return {
    schema_version: "hypothesis_card_v1",
    card_id: crypto.randomUUID(),
    program_id: input.programId,
    version: 1,
    status: "draft",
    title: input.proposal.title,
    claim: candidate.claim,
    intuition: candidate.rationale || candidate.claim,
    market_mechanism: candidate.mechanism,
    features: [{ id: "return_1", source: "ohlcv", source_field: "close", transform: "return", window: 1, lag: 0, timeframe: candidate.horizon || "15m" }],
    gates: [{ left: "return_1", op: ">=", right_param: "entry_threshold" }],
    entry: { direction: "bar_direction", timing: "bar_close_submit_next_bar_execution", pyramiding: false, flip: false, research_note: candidate.entry_idea },
    exit: { type: "fixed_stop_time_exit", stop_param: "stop_atr_multiple", max_hold_param: "max_hold_bars", research_note: candidate.exit_idea },
    sizing: { mode: "constant_r", risk_parameter: "r_per_trade", stop_required: true },
    risk_controls: { max_positions: 1, max_leverage: 1, forbid_pyramiding: true },
    parameters: { entry_threshold: [0], stop_atr_multiple: [2], max_hold_bars: [48], r_per_trade: [0.005] },
    data_requirements: data.length ? data : ["ohlcv"],
    logging_requirements: ["decision_trace", "feature_values", "stop_price", "stop_distance", "risk_amount"],
    evaluation: { tiers: ["Tier2", "Tier3"], metrics: ["ev_r", "max_drawdown", "drawdown_duration", "trade_count", "right_tail_shape"] },
    falsification_criteria: [candidate.falsification_test],
    expected_failure_modes: candidate.failure_modes,
    execution_semantics: { ...EXACT_EXECUTION_SEMANTICS, signal_timeframe: candidate.horizon || "15m", base_execution_timeframe: "1m", base_data_frequency_expected: "1m", exit_monitoring_timeframe: "1m", signal_bar_policy: "closed_bar_only" },
    source_citations: candidate.source_citations,
    field_provenance: {
      claim: { state: "stated", confidence: 1, source_ids: sourceIds },
      entry: { state: "recommended", confidence: 0.45, source_ids: sourceIds },
      exit: { state: "recommended", confidence: 0.45, source_ids: sourceIds },
      sizing: { state: "recommended", confidence: 0.4, source_ids: sourceIds },
    },
    prompt_version: RESEARCH_GENERATION_POLICY_VERSION,
  };
}

export function validateHypothesisCardV1(card: HypothesisCardV1, requireConfirmed = false): string[] {
  const errors: string[] = [];
  const required = ["card_id", "program_id", "title", "claim", "intuition", "market_mechanism", "features", "gates", "entry", "exit", "sizing", "risk_controls", "parameters", "data_requirements", "logging_requirements", "evaluation", "falsification_criteria", "expected_failure_modes", "execution_semantics", "field_provenance"] as const;
  if (card.schema_version !== "hypothesis_card_v1") errors.push("card_schema_version_invalid");
  for (const key of required) if (card[key] === undefined || card[key] === null || card[key] === "" || (Array.isArray(card[key]) && !card[key].length)) errors.push(`card_missing_${key}`);
  if (requireConfirmed && card.status !== "confirmed") errors.push("card_must_be_confirmed");
  if (requireConfirmed && (!card.confirmed_at || !card.confirmed_by)) errors.push("card_confirmation_identity_required");
  for (const [key, expected] of Object.entries(EXACT_EXECUTION_SEMANTICS)) if (card.execution_semantics[key] !== expected) errors.push(`card_execution_semantics_${key}_invalid`);
  card.features.forEach((feature, index) => {
    if (!feature.id || !feature.source || !feature.transform) errors.push(`card_feature_${index}_invalid`);
    if (Number(feature.lag ?? 0) < 0) errors.push(`card_feature_${index}_future_lag_forbidden`);
    if (feature.join && feature.join !== "backward") errors.push(`card_feature_${index}_join_must_be_backward`);
  });
  card.gates.forEach((gate, index) => { if (!PORTABLE_OPS.has(gate.op)) errors.push(`card_gate_${index}_invalid`); });
  for (const field of ["claim", "entry", "exit"]) {
    const state = card.field_provenance[field]?.state;
    if (requireConfirmed && ["inferred", "recommended", "unresolved", "unsupported"].includes(state)) errors.push(`card_blocking_field_${field}_not_confirmed`);
  }
  return [...new Set(errors)];
}

export function confirmCard(card: HypothesisCardV1, userId: string, now: string): HypothesisCardV1 {
  const provenance = structuredClone(card.field_provenance);
  for (const field of ["claim", "entry", "exit"]) provenance[field] = { ...(provenance[field] ?? { confidence: 1 }), state: "confirmed", confidence: 1 };
  return { ...card, status: "confirmed", confirmed_by: userId, confirmed_at: now, field_provenance: provenance };
}

export function compileReadiness(card: HypothesisCardV1, cardHash: string, availableDatasets?: string[]): CompileReadinessReport {
  const blockers: Array<{ code: string; detail: string }> = [];
  let status: CompileReadinessReport["status"];
  const available = new Set(availableDatasets ?? card.data_requirements);
  const missing = card.data_requirements.filter((item) => !available.has(item));
  const semanticErrors = validateHypothesisCardV1(card, true).filter((item) => item.includes("execution_semantics") || item.includes("blocking_field"));
  if (missing.length) { status = "data_blocked"; blockers.push(...missing.map((detail) => ({ code: "dataset_missing", detail }))); }
  else if (semanticErrors.length) { status = "semantics_blocked"; blockers.push(...semanticErrors.map((detail) => ({ code: "semantic_mismatch", detail }))); }
  else if (card.engine_strategy_name && REGISTERED_GENERATION_ADAPTERS.has(card.engine_strategy_name)) status = "registry_ready";
  else {
    const unsupported = card.features.filter((item) => !PORTABLE_TRANSFORMS.has(item.transform));
    const auxiliary = card.features.filter((item) => !["ohlcv", "derived"].includes(item.source));
    const featureIds = new Set(card.features.map((item) => item.id));
    const parameterIds = new Set(Object.keys(card.parameters));
    const badFeatureRefs = card.gates.map((item) => String(item.left ?? item.field ?? "")).filter((item) => !featureIds.has(item));
    const badParameterRefs = card.gates.filter((item) => item.right === undefined).map((item) => String(item.right_param ?? item.param ?? "")).filter((item) => !parameterIds.has(item));
    const sizingSupported = card.sizing.mode === "constant_r" && card.sizing.stop_required === true;
    const loggingSupported = ["decision_trace", "stop_price"].every((item) => card.logging_requirements.includes(item));
    if (unsupported.length || auxiliary.length || badFeatureRefs.length || badParameterRefs.length || card.exit.type !== "fixed_stop_time_exit" || !sizingSupported || !loggingSupported) {
      status = "implementation_required";
      blockers.push(...unsupported.map((item) => ({ code: "primitive_missing", detail: item.transform })));
      blockers.push(...auxiliary.map((item) => ({ code: "auxiliary_source_requires_implementation", detail: item.source })));
      blockers.push(...badFeatureRefs.map((detail) => ({ code: "feature_reference_missing", detail })));
      blockers.push(...badParameterRefs.map((detail) => ({ code: "parameter_reference_missing", detail })));
      if (card.exit.type !== "fixed_stop_time_exit") blockers.push({ code: "exit_not_portable", detail: String(card.exit.type) });
      if (!sizingSupported) blockers.push({ code: "sizing_not_portable", detail: String(card.sizing.mode) });
      if (!loggingSupported) blockers.push({ code: "logging_contract_incomplete", detail: "decision_trace,stop_price" });
    } else status = "graph_compilable";
  }
  return { schema_version: "compile_readiness_report_v1", strategy_spec_id: `strategy-${card.card_id}`, status, blockers, capabilities: { registered_strategy: Boolean(card.engine_strategy_name && REGISTERED_GENERATION_ADAPTERS.has(card.engine_strategy_name)), portable_feature_graph: card.features.every((item) => PORTABLE_TRANSFORMS.has(item.transform)), truth_contract_valid: !semanticErrors.length, engine_owned_risk: card.execution_semantics.risk_authority === "engine", rich_logging: ["decision_trace", "stop_price"].every((item) => card.logging_requirements.includes(item)) }, compiler_version: COMPILER_VERSION, source_card_hash: cardHash };
}

export function upgradeHypothesisSpecV1(spec: Record<string, unknown>) {
  if (spec.schema_version === "hypothesis_spec_v2") return structuredClone(spec);
  if (spec.schema_version !== "hypothesis_spec_v1") throw new Error("hypothesis_spec_version_unsupported");
  return { schema_version: "hypothesis_spec_v2", hypothesis_id: spec.hypothesis_id, program_id: spec.program_id, title: spec.title, claim: spec.claim, market_mechanism: spec.market_mechanism ?? "Unspecified in V1", observable_features: spec.observable_features ?? [], required_datasets: spec.required_datasets ?? [], invalidation_criteria: spec.invalidation_criteria ?? [], expected_failure_modes: spec.expected_failure_modes ?? [], parameter_grid: spec.parameter_grid ?? {}, evaluation: spec.evaluation ?? {}, execution_semantics: EXACT_EXECUTION_SEMANTICS, source_card_hash: null, source_citations: [], field_provenance: { legacy: { state: "extracted", confidence: 1 } }, compatibility: { upgraded_from: "hypothesis_spec_v1", execution_status: "requires_card_confirmation" } };
}

export function upgradeStrategySpecV1(spec: Record<string, unknown>) {
  if (spec.schema_version === "strategy_spec_v2") return structuredClone(spec);
  if (spec.schema_version !== "strategy_spec_v1") throw new Error("strategy_spec_version_unsupported");
  return { ...structuredClone(spec), schema_version: "strategy_spec_v2", execution_semantics: EXACT_EXECUTION_SEMANTICS, truth_contract: ENGINE_TRUTH_CONTRACT, source_card_hash: null, compiler_version: COMPILER_VERSION, user_approval_required: true, compatibility: { upgraded_from: "strategy_spec_v1", execution_status: "requires_card_confirmation" } };
}

export function buildSpecBundle(card: HypothesisCardV1, availableDatasets?: string[]) {
  const errors = validateHypothesisCardV1(card, true);
  if (errors.length) throw new Error(errors.join(";"));
  const cardHash = canonicalHash(card);
  const readiness = compileReadiness(card, cardHash, availableDatasets);
  const hypothesisSpec = { schema_version: "hypothesis_spec_v2", hypothesis_id: card.card_id, program_id: card.program_id, title: card.title, claim: card.claim, market_mechanism: card.market_mechanism, observable_features: card.features.map((item) => item.id), required_datasets: card.data_requirements, invalidation_criteria: card.falsification_criteria, expected_failure_modes: card.expected_failure_modes, parameter_grid: card.parameters, evaluation: card.evaluation, execution_semantics: card.execution_semantics, source_card_hash: cardHash, source_citations: card.source_citations, field_provenance: card.field_provenance };
  const strategySpec = { schema_version: "strategy_spec_v2", strategy_spec_id: `strategy-${card.card_id}`, program_id: card.program_id, hypothesis_id: card.card_id, engine_strategy_name: card.engine_strategy_name, feature_graph: card.features, gate_graph: card.gates, entry: card.entry, exit_state_machine: card.exit, sizing: card.sizing, risk_policy: card.risk_controls, parameter_grid: card.parameters, parameter_defaults: Object.fromEntries(Object.entries(card.parameters).map(([key, values]) => [key, values[0]])), data_requirements: card.data_requirements, logging_contract: card.logging_requirements, evaluation_contract: card.evaluation, falsification_contract: card.falsification_criteria, execution_semantics: card.execution_semantics, truth_contract: ENGINE_TRUTH_CONTRACT, source_card_hash: cardHash, compiler_version: COMPILER_VERSION, user_approval_required: true };
  const engineHypothesis = { hypothesis_id: card.card_id, title: card.title, description: card.claim, research_layer: "generated", hypothesis_family: card.engine_strategy_name ? "registered_adapter" : "portable_research_graph", version: "1.0.0", author: "invariance_research", created_at: card.confirmed_at, required_indicators: [], indicator_defaults: {}, parameter_grid: card.parameters, gates: card.gates, entry: { ...card.entry, strategy: card.engine_strategy_name ?? "research_graph_v1", signal_timeframe: card.execution_semantics.signal_timeframe }, exit: card.exit, execution_semantics: card.execution_semantics, evaluation: { required_tiers: card.evaluation.tiers ?? ["Tier2", "Tier3"] }, logging: { schema_version: "1.0", required_fields: card.logging_requirements }, runtime_controls: { enabled: true, max_variants: 128, tags: ["generated", "confirmed_card"] }, truth_contract: ENGINE_TRUTH_CONTRACT, generation_provenance: { schema_version: "engine_hypothesis_yaml_v1", source_card_hash: cardHash, compiler_version: COMPILER_VERSION } };
  const implementationTask = readiness.status === "implementation_required" ? { schema_version: "strategy_implementation_task_v1", task_id: `implementation-strategy-${card.card_id}`, strategy_spec_id: strategySpec.strategy_spec_id, strategy_spec_hash: canonicalHash(strategySpec), source_card_hash: cardHash, status: "draft", blockers: readiness.blockers, required_deliverables: ["strategy_module", "strategy_registry_entry", "feature_kernel", "hypothesis_yaml", "hypothesis_documentation", "contract_tests", "integration_smoke"], required_evidence: ["admission_PASS", "lookahead_tests", "determinism_tests", "rich_logging_tests", "OHLCV_fallback_smoke", "enriched_data_smoke", "stable_membership_smoke", "volatile_membership_smoke", "classic_fast_parity_or_classic_only", "experiment_truth_PASS"], prohibited_shortcuts: ["future_values", "forward_aux_join", "interpolation", "strategy_owned_execution", "strategy_owned_risk", "uncertified_result_publication"], approval_required: true } : undefined;
  const runConfig = ["registry_ready", "graph_compilable"].includes(readiness.status) ? { schema_version: "run_config_from_strategy_spec_v2", strategy_spec_id: strategySpec.strategy_spec_id, strategy_spec_hash: canonicalHash(strategySpec), strategy: { name: readiness.status === "registry_ready" ? card.engine_strategy_name : "research_graph_v1", parameters: strategySpec.parameter_defaults, research_graph: { features: card.features, gates: card.gates, entry: card.entry, exit: card.exit } }, required_datasets: card.data_requirements, risk: card.risk_controls, execution_semantics: card.execution_semantics, truth_contract: ENGINE_TRUTH_CONTRACT, compiler: { version: COMPILER_VERSION, status: readiness.status } } : undefined;
  return { schema_version: "research_spec_bundle_v2", card, hypothesis_spec: hypothesisSpec, engine_hypothesis_yaml: engineHypothesis, engine_hypothesis_yaml_text: toYaml(engineHypothesis, { sortMapEntries: false }), strategy_spec: strategySpec, compile_readiness: readiness, ...(implementationTask ? { implementation_task: implementationTask } : {}), ...(runConfig ? { run_config: runConfig } : {}) };
}
