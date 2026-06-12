import type {
  ExperimentPlanItemV1,
  ExperimentPlanV1,
  StrategySpecV1,
} from "@/lib/server/research-programs/models";

const allowedTypes = new Set(["baseline", "cost_sensitivity", "slippage_sensitivity", "parameter_grid", "holdout_split", "benchmark_null", "regime_state_split", "alternative_exit"]);

function numeric(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function buildExperimentPlanFromStrategySpec(input: {
  planId: string;
  strategySpec: StrategySpecV1;
}): ExperimentPlanV1 {
  const spec = input.strategySpec;
  const datasets = new Set(spec.required_datasets);
  const costBps = numeric(spec.cost_model.round_trip_bps, 8);
  const slippageBps = numeric(spec.slippage_model.round_trip_bps, 4);
  const baseDatasets = spec.required_datasets;
  const items: ExperimentPlanItemV1[] = [
    {
      item_id: "baseline",
      experiment_type: "baseline",
      title: "Baseline approved strategy spec",
      priority: 100,
      enabled: true,
      required_datasets: baseDatasets,
      runtime_budget: { max_minutes: 30, max_variants: 1 },
      config_patch: {},
      falsification_question: "Does the approved strategy spec survive its declared base assumptions?",
    },
    {
      item_id: "cost_sensitivity_2x",
      experiment_type: "cost_sensitivity",
      title: "Cost sensitivity 2x",
      priority: 90,
      enabled: true,
      required_datasets: baseDatasets,
      runtime_budget: { max_minutes: 30, max_variants: 1 },
      config_patch: { cost_model: { ...spec.cost_model, round_trip_bps: costBps * 2 } },
      falsification_question: "Does the edge survive doubled explicit trading cost?",
    },
    {
      item_id: "slippage_sensitivity_2x",
      experiment_type: "slippage_sensitivity",
      title: "Slippage sensitivity 2x",
      priority: 85,
      enabled: true,
      required_datasets: baseDatasets,
      runtime_budget: { max_minutes: 30, max_variants: 1 },
      config_patch: { slippage_model: { ...spec.slippage_model, round_trip_bps: slippageBps * 2 } },
      falsification_question: "Does the edge survive worse fills?",
    },
    {
      item_id: "benchmark_null",
      experiment_type: "benchmark_null",
      title: "Benchmark and null comparison",
      priority: 80,
      enabled: true,
      required_datasets: [...new Set([...baseDatasets, "benchmark"])],
      runtime_budget: { max_minutes: 30, max_variants: 3 },
      config_patch: { null_model: "random_entry_same_hold_time" },
      falsification_question: "Does the strategy beat a simple benchmark and matched random-entry null?",
    },
    {
      item_id: "parameter_grid_safe",
      experiment_type: "parameter_grid",
      title: "Safe parameter grid",
      priority: 75,
      enabled: true,
      required_datasets: baseDatasets,
      runtime_budget: { max_minutes: 90, max_variants: Math.min(27, Math.max(3, Object.keys(spec.parameters).length * 3)) },
      config_patch: { parameter_grid: spec.parameters },
      falsification_question: "Does the result depend on one fragile parameter point?",
    },
    {
      item_id: "holdout_split_late",
      experiment_type: "holdout_split",
      title: "Late-period holdout split",
      priority: 70,
      enabled: true,
      required_datasets: baseDatasets,
      runtime_budget: { max_minutes: 45, max_variants: 2 },
      config_patch: { split: { kind: "time_holdout", holdout_fraction: 0.33 } },
      falsification_question: "Does the result survive a later out-of-sample window?",
    },
  ];
  if (["funding", "open_interest", "liquidations", "research_panel"].some((dataset) => datasets.has(dataset))) {
    items.push({
      item_id: "regime_state_split",
      experiment_type: "regime_state_split",
      title: "Declared state split",
      priority: 65,
      enabled: true,
      required_datasets: baseDatasets,
      runtime_budget: { max_minutes: 60, max_variants: 4 },
      config_patch: { state_split: { kind: "declared_context_fields" } },
      falsification_question: "Is performance concentrated in one market state?",
    });
  }
  if (spec.signals.some((signal) => signal.function === "atr_stop")) {
    items.push({
      item_id: "alternative_exit_wider_stop",
      experiment_type: "alternative_exit",
      title: "Alternative exit: wider stop",
      priority: 60,
      enabled: true,
      required_datasets: baseDatasets,
      runtime_budget: { max_minutes: 30, max_variants: 1 },
      config_patch: { exit_variant: { atr_stop_multiple_multiplier: 1.25 } },
      falsification_question: "Is the result overly dependent on one stop placement?",
    });
  }
  return {
    schema_version: "experiment_plan_v1",
    plan_id: `PLAN-${input.planId.slice(0, 8).toUpperCase()}`,
    strategy_spec_id: spec.strategy_spec_id,
    hypothesis_id: spec.hypothesis_id,
    plan_title: `Falsification plan for ${spec.strategy_spec_id}`,
    status: "draft",
    items,
    limits: {
      max_concurrent: 1,
      max_queued_items: items.length,
      estimated_compute_units: items.reduce((sum, item) => sum + item.runtime_budget.max_variants, 0),
    },
    approval_required: true,
  };
}

export function validateExperimentPlan(plan: ExperimentPlanV1): string[] {
  const errors: string[] = [];
  if (plan.schema_version !== "experiment_plan_v1") errors.push("schema_version_must_be_experiment_plan_v1");
  if (!Array.isArray(plan.items) || plan.items.length === 0) errors.push("items_must_be_non_empty_list");
  const seen = new Set<string>();
  for (const [index, item] of (plan.items ?? []).entries()) {
    if (!item.item_id) errors.push(`item_${index}_missing_item_id`);
    if (seen.has(item.item_id)) errors.push(`item_${index}_duplicate_item_id`);
    seen.add(item.item_id);
    if (!allowedTypes.has(item.experiment_type)) errors.push(`item_${index}_experiment_type_unsupported`);
    if (!item.required_datasets?.length) errors.push(`item_${index}_required_datasets_missing`);
    if (!item.runtime_budget || item.runtime_budget.max_minutes <= 0 || item.runtime_budget.max_variants <= 0) errors.push(`item_${index}_runtime_budget_invalid`);
    if (!item.falsification_question) errors.push(`item_${index}_missing_falsification_question`);
  }
  if (!plan.limits || plan.limits.max_concurrent <= 0 || plan.limits.max_queued_items <= 0 || plan.limits.estimated_compute_units <= 0) {
    errors.push("limits_invalid");
  }
  return errors;
}

export function experimentLimitsForPlan(planId: string) {
  switch (planId) {
    case "research_desk":
      return { maxQueued: 100, maxConcurrent: 6, monthlyComputeUnits: 1000 };
    case "team":
      return { maxQueued: 80, maxConcurrent: 4, monthlyComputeUnits: 600 };
    case "pro":
      return { maxQueued: 40, maxConcurrent: 2, monthlyComputeUnits: 250 };
    case "explorer":
      return { maxQueued: 12, maxConcurrent: 1, monthlyComputeUnits: 80 };
    default:
      return { maxQueued: 3, maxConcurrent: 1, monthlyComputeUnits: 15 };
  }
}
