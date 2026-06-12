import type {
  HypothesisSpecV1,
  ParameterRange,
  ResearchBriefRecord,
  ResearchProgram,
  StrategySpecV1,
} from "@/lib/server/research-programs/models";

const allowedDatasets = new Set(["ohlcv", "trades", "funding", "open_interest", "mark_price", "index_price", "liquidations", "benchmark", "research_panel"]);
const allowedTimeframes = new Set(["1m", "5m", "15m", "1h", "4h", "1d"]);
const allowedFamilies = new Set(["trend_continuation", "mean_reversion", "breakout", "volatility_filter", "funding_liquidation_context"]);
const lookaheadPatterns = [/lookahead/i, /future/i, /lead\s*\(/i, /shift\s*\(\s*-/i, /next_bar/i, /tomorrow/i];
const registeredSignalFunctions = new Set([
  "ema_cross",
  "donchian_breakout",
  "vwap_reversion",
  "atr_stop",
  "volatility_percentile_gate",
  "funding_extreme_gate",
  "liquidation_impulse_gate",
  "time_stop",
]);

function words(value?: string) {
  return (value ?? "").trim();
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 36) || "hypothesis";
}

function datasetGuess(brief: ResearchBriefRecord): string[] {
  const text = `${brief.brief.data_source ?? ""} ${brief.brief.market_intuition} ${brief.brief.entry_idea ?? ""}`.toLowerCase();
  const out = new Set<string>(["ohlcv", "benchmark"]);
  if (/funding/.test(text)) out.add("funding");
  if (/open interest|\boi\b/.test(text)) out.add("open_interest");
  if (/mark/.test(text)) out.add("mark_price");
  if (/index/.test(text)) out.add("index_price");
  if (/liquidat/.test(text)) out.add("liquidations");
  return [...out];
}

function familyGuess(spec: HypothesisSpecV1): StrategySpecV1["strategy_family"] {
  const text = `${spec.title} ${spec.thesis} ${spec.entry_condition_intent}`.toLowerCase();
  if (/funding|liquidat|open interest|\boi\b/.test(text)) return "funding_liquidation_context";
  if (/mean reversion|revert|vwap|oversold|overbought/.test(text)) return "mean_reversion";
  if (/breakout|range expansion|donchian/.test(text)) return "breakout";
  if (/volatility|vol filter|atr/.test(text)) return "volatility_filter";
  return "trend_continuation";
}

function safeRanges(): Record<string, ParameterRange> {
  return {
    lookback_bars: { min: 20, max: 120, default: 55 },
    atr_stop_multiple: { min: 1.2, max: 4, default: 2.2 },
    volatility_floor_pctile: { min: 40, max: 90, default: 65 },
  };
}

export function buildHypothesisSpecFromBrief(input: {
  program: ResearchProgram;
  brief: ResearchBriefRecord;
  hypothesisId: string;
  generatedAt: string;
}): HypothesisSpecV1 {
  const brief = input.brief.brief;
  const title = words(brief.title) || input.program.title;
  const timeframe = words(brief.timeframe) || words(input.program.timeframe) || "15m";
  return {
    schema_version: "hypothesis_spec_v1",
    hypothesis_id: `HYP-${slug(title).toUpperCase()}-${input.hypothesisId.slice(0, 8)}`,
    title,
    thesis: words(brief.thesis) || input.program.thesis,
    market_mechanism: words(brief.market_intuition),
    observable_features: ["close", "high", "low", "volume", "atr"],
    entry_condition_intent: words(brief.entry_idea) || "Define a closed-bar entry condition before strategy generation.",
    exit_condition_intent: words(brief.exit_idea) || "Use explicit stop, time stop, and thesis invalidation exits.",
    invalidation_criteria: [
      words(brief.disproof_condition) || "The result fails after explicit cost and slippage stress.",
      "Performance is dominated by a small number of rare trades.",
      "Out-of-sample performance fails the pre-registered null benchmark.",
    ],
    required_datasets: datasetGuess(input.brief),
    cost_model_assumptions: words(brief.cost_slippage_assumption) || "Use explicit fees and conservative round-trip slippage before promotion.",
    benchmark_or_null: "Compare against random-entry same-hold-time null and buy-and-hold benchmark where available.",
    expected_failure_modes: ["cost drag", "regime dependence", "loss clustering", "rare-trade dominance"],
    safe_parameter_ranges: safeRanges(),
    out_of_sample_plan: "Hold out a later time slice and require the result to survive cost perturbation before promotion.",
    execution_semantics: {
      signal_timeframe: allowedTimeframes.has(timeframe) ? timeframe : "15m",
      base_data_frequency_expected: "1m",
      signal_bar_policy: "closed_bar_only",
      exit_monitoring_timeframe: "1m",
      no_pyramiding: true,
    },
    source_brief_id: input.brief.brief_id,
    generated_by: "deterministic_assistant",
    generated_at: input.generatedAt,
  };
}

export function validateHypothesisSpec(spec: HypothesisSpecV1): string[] {
  const required: Array<keyof HypothesisSpecV1> = [
    "schema_version",
    "hypothesis_id",
    "title",
    "thesis",
    "market_mechanism",
    "observable_features",
    "entry_condition_intent",
    "exit_condition_intent",
    "invalidation_criteria",
    "required_datasets",
    "cost_model_assumptions",
    "benchmark_or_null",
    "expected_failure_modes",
    "safe_parameter_ranges",
    "out_of_sample_plan",
    "execution_semantics",
  ];
  const errors = required.filter((field) => {
    const value = spec[field];
    return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
  }).map((field) => `missing_${field}`);
  if (spec.schema_version !== "hypothesis_spec_v1") errors.push("schema_version_must_be_hypothesis_spec_v1");
  for (const dataset of spec.required_datasets ?? []) {
    if (!allowedDatasets.has(dataset)) errors.push(`unknown_required_dataset_${dataset}`);
  }
  const tf = String(spec.execution_semantics?.signal_timeframe ?? "");
  if (!allowedTimeframes.has(tf)) errors.push("execution_semantics_signal_timeframe_unsupported");
  for (const [name, range] of Object.entries(spec.safe_parameter_ranges ?? {})) {
    if (typeof range.min !== "number" || typeof range.max !== "number" || range.min >= range.max) {
      errors.push(`safe_parameter_range_${name}_invalid`);
    }
  }
  return errors;
}

export function buildStrategySpecFromHypothesis(input: {
  hypothesisVersionId: string;
  hypothesis: HypothesisSpecV1;
  strategySpecId: string;
  generatedAt: string;
}): StrategySpecV1 {
  const family = familyGuess(input.hypothesis);
  const timeframe = String(input.hypothesis.execution_semantics.signal_timeframe ?? "15m");
  const base = {
    schema_version: "strategy_spec_v1" as const,
    strategy_spec_id: `STRAT-${input.strategySpecId.slice(0, 8).toUpperCase()}`,
    hypothesis_id: input.hypothesis.hypothesis_id,
    hypothesis_version_id: input.hypothesisVersionId,
    strategy_family: family,
    universe: ["USER_DEFINED_UNIVERSE"],
    timeframe: allowedTimeframes.has(timeframe) ? timeframe : "15m",
    required_datasets: input.hypothesis.required_datasets,
    parameters: input.hypothesis.safe_parameter_ranges,
    cost_model: { kind: "bps", round_trip_bps: 8, source: "assistant_default_user_must_review" },
    slippage_model: { kind: "bps", round_trip_bps: 4, source: "assistant_default_user_must_review" },
    risk_model: { kind: "fixed_fractional", risk_per_trade_pct: 0.5, no_pyramiding: true },
    execution_semantics: {
      lookahead_allowed: false,
      interpolation_allowed: false,
      signal_bar_policy: "closed_bar_only",
      base_data_frequency_expected: "1m",
      exit_monitoring_timeframe: "1m",
    },
    compiler: {
      target: "classic_engine_run_config",
      safe_mode: "classic_with_optional_compiled_features",
      assistant_assumptions: ["Universe must be replaced with concrete symbols before execution.", "Cost and slippage defaults require user approval."],
    },
    assistant_assumptions: ["Universe must be replaced with concrete symbols before execution.", "Cost and slippage defaults require user approval."],
    user_approval_required: true as const,
    generated_by: "deterministic_assistant" as const,
    generated_at: input.generatedAt,
  };
  const signalsByFamily: Record<StrategySpecV1["strategy_family"], StrategySpecV1["signals"]> = {
    trend_continuation: [
      { name: "trend_context", function: "ema_cross", fields: ["close"], closed_bar_only: true },
      { name: "volatility_gate", function: "volatility_percentile_gate", fields: ["atr", "close"], threshold_param: "volatility_floor_pctile" },
      { name: "stop", function: "atr_stop", fields: ["atr", "close"], multiple_param: "atr_stop_multiple" },
    ],
    mean_reversion: [
      { name: "vwap_reversion", function: "vwap_reversion", fields: ["close", "vwap"], closed_bar_only: true },
      { name: "stop", function: "atr_stop", fields: ["atr", "close"], multiple_param: "atr_stop_multiple" },
    ],
    breakout: [
      { name: "range_breakout", function: "donchian_breakout", fields: ["close", "high", "low"], closed_bar_only: true },
      { name: "stop", function: "atr_stop", fields: ["atr", "close"], multiple_param: "atr_stop_multiple" },
    ],
    volatility_filter: [
      { name: "volatility_gate", function: "volatility_percentile_gate", fields: ["atr", "close"], threshold_param: "volatility_floor_pctile" },
      { name: "trend_context", function: "ema_cross", fields: ["close"], closed_bar_only: true },
    ],
    funding_liquidation_context: [
      { name: "funding_extreme", function: "funding_extreme_gate", fields: ["funding_rate"], closed_bar_only: true },
      { name: "liquidation_impulse", function: "liquidation_impulse_gate", fields: ["liquidation_notional"], closed_bar_only: true },
      { name: "stop", function: "atr_stop", fields: ["atr", "close"], multiple_param: "atr_stop_multiple" },
    ],
  };
  return { ...base, signals: signalsByFamily[family] };
}

export function validateStrategySpec(spec: StrategySpecV1): string[] {
  const errors: string[] = [];
  if (spec.schema_version !== "strategy_spec_v1") errors.push("schema_version_must_be_strategy_spec_v1");
  if (!allowedFamilies.has(spec.strategy_family)) errors.push("strategy_family_unsupported");
  if (!allowedTimeframes.has(spec.timeframe)) errors.push("timeframe_unsupported");
  if (!Array.isArray(spec.universe) || spec.universe.length === 0) errors.push("universe_must_be_non_empty_list");
  if (!Array.isArray(spec.required_datasets) || spec.required_datasets.length === 0) errors.push("required_datasets_must_be_non_empty_list");
  for (const dataset of spec.required_datasets ?? []) {
    if (!allowedDatasets.has(dataset)) errors.push(`unknown_required_dataset_${dataset}`);
  }
  if (spec.execution_semantics.lookahead_allowed !== false) errors.push("lookahead_allowed_must_be_false");
  if (spec.execution_semantics.interpolation_allowed !== false) errors.push("interpolation_allowed_must_be_false_unless_explicitly_reviewed");
  if (!Array.isArray(spec.signals) || spec.signals.length === 0) errors.push("signals_must_be_non_empty_list");
  for (const [index, signal] of (spec.signals ?? []).entries()) {
    if (!registeredSignalFunctions.has(String(signal.function))) errors.push(`signal_${index}_function_not_registered`);
    const body = JSON.stringify(signal);
    if (lookaheadPatterns.some((pattern) => pattern.test(body))) errors.push(`signal_${index}_contains_lookahead_language`);
  }
  for (const [name, range] of Object.entries(spec.parameters ?? {})) {
    if (typeof range.min !== "number" || typeof range.max !== "number" || range.min >= range.max) {
      errors.push(`parameter_${name}_invalid_range`);
    }
  }
  return errors;
}
