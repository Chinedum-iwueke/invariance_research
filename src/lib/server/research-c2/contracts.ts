import { createHash } from "node:crypto";

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value))
    return `[${value.map((item) => (item === undefined ? "null" : canonicalJson(item))).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export function canonicalHash(value: unknown) {
  return createHash("sha256")
    .update(typeof value === "string" ? value : canonicalJson(value))
    .digest("hex");
}

export function normalizePortableIr(spec: Record<string, unknown>) {
  for (const key of [
    "strategy_spec_id",
    "feature_graph",
    "gate_graph",
    "entry",
    "exit_state_machine",
    "parameter_defaults",
    "execution_semantics",
    "truth_contract",
  ])
    if (spec[key] === undefined) throw new Error(`portable_ir_missing:${key}`);
  const ir = {
    schema_version: "portable_strategy_ir_v1",
    strategy_spec_id: spec.strategy_spec_id,
    strategy_spec_hash: canonicalHash(spec),
    features: spec.feature_graph,
    gates: spec.gate_graph,
    entry: spec.entry,
    exit: spec.exit_state_machine,
    parameters: spec.parameter_defaults,
    parameter_grid: spec.parameter_grid ?? {},
    data_requirements: [
      ...new Set((spec.data_requirements as string[] | undefined) ?? []),
    ].sort(),
    risk_policy: spec.risk_policy ?? {},
    execution_semantics: spec.execution_semantics,
    truth_contract: spec.truth_contract,
    compiler_version: spec.compiler_version,
  };
  return ir as typeof ir & {
    strategy_spec_id: string;
    strategy_spec_hash: string;
    features: Array<Record<string, unknown>>;
    gates: Array<Record<string, unknown>>;
    entry: Record<string, unknown>;
    exit: Record<string, unknown>;
    parameters: Record<string, unknown>;
    data_requirements: string[];
    risk_policy: Record<string, unknown>;
    execution_semantics: Record<string, unknown>;
  };
}

export function targetCompatibility(
  ir: ReturnType<typeof normalizePortableIr>,
) {
  const portable = new Set([
    "identity",
    "return",
    "sma",
    "ema",
    "atr",
    "true_range",
    "true_range_over",
    "half_range_over_close",
  ]);
  const privateSources = [
    ...new Set(
      ir.features
        .filter((item) => !["ohlcv", "derived"].includes(String(item.source)))
        .map((item) => String(item.source)),
    ),
  ];
  const unsupportedDatasets = ir.data_requirements
    .filter((item) => item !== "ohlcv")
    .map((item) => `dataset:${item}`);
  const transforms = [
    ...new Set(
      ir.features
        .filter((item) => !portable.has(String(item.transform)))
        .map((item) => String(item.transform)),
    ),
  ];
  const unresolved = [
    ir.execution_semantics.signal_bar_policy !== undefined &&
    ir.execution_semantics.signal_bar_policy !== "closed_bar_only"
      ? "signal_bar_not_closed_only"
      : "",
    ir.execution_semantics.interpolation !== "forbidden"
      ? "interpolation_not_forbidden"
      : "",
    ir.execution_semantics.intrabar_semantics &&
    ir.execution_semantics.intrabar_semantics !== "disabled"
      ? "unresolved_intrabar_semantics"
      : "",
    ir.execution_semantics.higher_timeframe_data === true &&
    ir.execution_semantics.higher_timeframe_confirmation !==
      "confirmed_closed_bar"
      ? "unconfirmed_higher_timeframe_data"
      : "",
    ir.risk_policy.portfolio_state_required === true
      ? "portfolio_state_required"
      : "",
  ].filter(Boolean);
  const visualizationBlockers = [
    ...privateSources,
    ...unsupportedDatasets,
    ...unresolved,
  ];
  const exitStopParam = String(ir.exit.stop_param ?? ""),
    exitHoldParam = String(ir.exit.max_hold_param ?? "");
  const exitPortable =
    ir.exit.type === "fixed_stop_time_exit" &&
    exitStopParam &&
    exitHoldParam &&
    typeof ir.parameters[exitStopParam] === "number" &&
    typeof ir.parameters[exitHoldParam] === "number";
  const simulationBlockers = [
    ...visualizationBlockers,
    ...transforms,
    !exitPortable ? "exit_not_simulation_portable" : "",
  ].filter(Boolean);
  return {
    visualization: visualizationBlockers.length ? "unsupported" : "compatible",
    simulation: simulationBlockers.length ? "unsupported" : "compatible",
    visualization_blockers: visualizationBlockers,
    simulation_blockers: simulationBlockers,
  };
}

export function buildQualification(input: {
  qualificationId: string;
  programId: string;
  ir: ReturnType<typeof normalizePortableIr>;
  evidence: Record<string, unknown>;
  approval: Record<string, unknown>;
}) {
  const e = input.evidence;
  const targets = targetCompatibility(input.ir);
  const riskHash = canonicalHash(input.ir.risk_policy);
  const configHash = String(e.config_hash ?? "");
  const checks: Array<[string, boolean]> = [
    [
      "reproducible_lineage",
      Boolean(e.code_hash && e.data_snapshot_id && configHash),
    ],
    ["truth_certification", e.truth_certification === "PASS"],
    ["experiment_contract", !Boolean(e.blocking_contract_errors)],
    [
      "execution_assumptions",
      [
        "fees_bps",
        "slippage_bps",
        "spread_bps",
        "timing_model",
        "leverage",
        "liquidation_model",
      ].every((key) => e[key] !== undefined && e[key] !== null),
    ],
    [
      "sample_threshold",
      Number(e.trade_count ?? 0) >= Number(e.minimum_trade_count ?? 30),
    ],
    [
      "coverage_threshold",
      Number(e.coverage_days ?? 0) >= Number(e.minimum_coverage_days ?? 90),
    ],
    [
      "holdout_evidence",
      e.holdout_required === false || e.holdout_status === "PASS",
    ],
    ["cost_survival", e.cost_survival === "PASS"],
    [
      "ruin_limit",
      Number(e.risk_of_ruin ?? 1) <= Number(e.maximum_risk_of_ruin ?? 0.05),
    ],
    [
      "supported_symbols",
      Array.isArray(e.symbols) &&
        e.symbols.length > 0 &&
        Boolean(e.exchange_product_type),
    ],
    ["critical_verdicts", Number(e.unresolved_critical_verdicts ?? 0) === 0],
    ["simulation_compatible", targets.simulation === "compatible"],
    [
      "exact_hash_approval",
      input.approval.strategy_spec_hash === input.ir.strategy_spec_hash &&
        input.approval.risk_policy_hash === riskHash &&
        input.approval.config_hash === configHash &&
        Boolean(input.approval.approved_by && input.approval.approved_at),
    ],
  ];
  const rules = checks.map(([rule, pass]) => ({
    rule,
    status: pass ? "pass" : "block",
    required: true,
  }));
  const blockers = rules
    .filter((item) => item.status === "block")
    .map((item) => item.rule);
  const snapshot = {
    schema_version: "deployment_qualification_v1",
    qualification_id: input.qualificationId,
    program_id: input.programId,
    stage_from: "backtest",
    stage_to: "demo",
    status: blockers.length ? "blocked" : "qualified",
    strategy_spec_id: input.ir.strategy_spec_id,
    strategy_spec_hash: input.ir.strategy_spec_hash,
    risk_policy_hash: riskHash,
    config_hash: configHash,
    code_hash: e.code_hash,
    data_snapshot_id: e.data_snapshot_id,
    experiment_run_id: e.experiment_run_id,
    rules,
    blockers,
    required_next_tests: blockers.map(
      (item) => `Resolve qualification rule: ${item}.`,
    ),
    target_compatibility: targets,
    limitations: e.limitations ?? [],
    approval: input.approval,
  };
  return { ...snapshot, snapshot_hash: canonicalHash(snapshot) };
}

const PORTABILITY: Record<string, string> = {
  identity: "{source}",
  return: "ta.change({source}) / {source}[1]",
  sma: "ta.sma({source}, {window})",
  ema: "ta.ema({source}, {window})",
  atr: "ta.atr({window})",
  true_range: "ta.tr(true)",
  true_range_over: "ta.tr(true) / {input}",
  half_range_over_close: "0.5 * (high - low) / close",
};
export function pineCompatibility(ir: ReturnType<typeof normalizePortableIr>) {
  const targets = targetCompatibility(ir);
  const unsupported = [
    ...new Set([
      ...ir.features
        .filter((item) => !PORTABILITY[String(item.transform)])
        .map((item) => `primitive:${item.transform}`),
      ...ir.data_requirements
        .filter((item) => item !== "ohlcv")
        .map((item) => `dataset:${item}`),
      ...targets.visualization_blockers,
    ]),
  ];
  const report = {
    schema_version: "pine_compatibility_report_v1",
    status: unsupported.length ? "unsupported" : "visualization_compatible",
    simulation_status:
      !unsupported.length && targets.simulation === "compatible"
        ? "simulation_compatible"
        : "unsupported",
    portable_primitives: ir.features.map((item) => ({
      feature_id: item.id,
      primitive: item.transform,
      pine_supported: Boolean(PORTABILITY[String(item.transform)]),
    })),
    unsupported,
    approximations: [
      "TradingView chart data and alerts are not engine execution evidence.",
    ],
    session_mapping: ir.execution_semantics.session ?? "24x7_crypto",
    timezone_mapping: "UTC",
    timeframe_mapping: ir.execution_semantics.signal_timeframe,
    risk_omissions: ["account and portfolio risk remain engine-owned"],
    compiler_version: "pine_bridge_v1",
  };
  return { ...report, report_hash: canonicalHash(report) };
}

export function compilePine(
  ir: ReturnType<typeof normalizePortableIr>,
  input: {
    exportId: string;
    programId: string;
    generatedAt: string;
    approved: boolean;
  },
) {
  if (!input.approved) throw new Error("approved_strategy_spec_required");
  const compatibility = pineCompatibility(ir);
  if (compatibility.status === "unsupported")
    throw new Error(
      `pine_visualization_unsupported:${compatibility.unsupported.join(",")}`,
    );
  const sanitize = (value: unknown) =>
    String(value).replace(/[^A-Za-z0-9_]/g, "_");
  const displayName = String(ir.strategy_spec_id)
    .replace(/["\\\r\n]/g, "_")
    .slice(0, 120);
  const lines = [
    "//@version=6",
    `// Invariance Research visualization | compiler=pine_bridge_v1`,
    `// program=${input.programId} | strategy_spec_hash=${ir.strategy_spec_hash}`,
    "// TradingView output is not an engine validation result.",
    `indicator("${displayName} visualization", overlay=true, max_labels_count=200)`,
  ];
  for (const [key, value] of Object.entries(ir.parameters).sort(([a], [b]) =>
    a.localeCompare(b),
  ))
    if (typeof value === "number") {
      const grid = (ir.parameter_grid as Record<string, unknown[]>)[key] ?? [
          value,
        ],
        nums = grid.filter((x): x is number => typeof x === "number");
      lines.push(
        `p_${sanitize(key)} = input.float(${value}, "${key}", minval=${Math.min(...nums, value)}, maxval=${Math.max(...nums, value)})`,
      );
    }
  for (const feature of ir.features) {
    const template = PORTABILITY[String(feature.transform)];
    const inputs = feature.inputs as string[] | undefined;
    const sourceField = String(feature.source_field ?? "close");
    if (!["open", "high", "low", "close", "volume"].includes(sourceField))
      throw new Error(`pine_source_field_unsupported:${sourceField}`);
    const expr = template
      .replaceAll("{source}", sourceField)
      .replaceAll("{window}", String(feature.window ?? 1))
      .replaceAll("{input}", sanitize(inputs?.[0] ?? "close"));
    lines.push(
      `${sanitize(feature.id)} = (${expr})${Number(feature.lag ?? 0) ? `[${Number(feature.lag)}]` : ""}`,
    );
  }
  const gates = ir.gates.map((gate, index) => {
    const name = `gate_${index}`;
    if (![">", ">=", "<", "<=", "=="].includes(String(gate.op)))
      throw new Error(`pine_gate_operator_unsupported:${String(gate.op)}`);
    const right =
      gate.right === undefined
        ? `p_${sanitize(gate.right_param ?? gate.param)}`
        : typeof gate.right === "number"
          ? String(gate.right)
          : sanitize(gate.right);
    lines.push(
      `${name} = ${sanitize(gate.left ?? gate.field)} ${gate.op} ${right}`,
    );
    return name;
  });
  lines.push(
    `confirmed_signal = barstate.isconfirmed and ${gates.length ? gates.join(" and ") : "false"}`,
    "long_signal = confirmed_signal and close >= open",
    "short_signal = confirmed_signal and close < open",
    "atr_visual = ta.atr(14)",
    "stop_multiple = 2.0",
    "long_stop = long_signal ? close - atr_visual * stop_multiple : na",
    "short_stop = short_signal ? close + atr_visual * stop_multiple : na",
    'plot(long_stop, title="Long invalidation", color=color.red, style=plot.style_linebr)',
    'plot(short_stop, title="Short invalidation", color=color.red, style=plot.style_linebr)',
    'plotshape(long_signal, title="Long", style=shape.triangleup, location=location.belowbar, color=color.green)',
    'plotshape(short_signal, title="Short", style=shape.triangledown, location=location.abovebar, color=color.red)',
    "var status_table = table.new(position.top_right, 1, 2)",
    "if barstate.islast",
    '    table.cell(status_table, 0, 0, "Invariance visualization")',
    `    table.cell(status_table, 0, 1, "Spec ${ir.strategy_spec_hash.slice(0, 12)} | provisional")`,
    String.raw`alertcondition(long_signal, title="Confirmed long", message="{\"idempotency_key\":\"${input.exportId}:{{ticker}}:{{interval}}:{{time}}:long\",\"symbol\":\"{{ticker}}\",\"timeframe\":\"{{interval}}\",\"confirmed_bar_timestamp\":\"{{time}}\",\"side\":\"long\",\"event_type\":\"entry\",\"strategy_spec_hash\":\"${ir.strategy_spec_hash}\",\"confirmed\":true}")`,
    String.raw`alertcondition(short_signal, title="Confirmed short", message="{\"idempotency_key\":\"${input.exportId}:{{ticker}}:{{interval}}:{{time}}:short\",\"symbol\":\"{{ticker}}\",\"timeframe\":\"{{interval}}\",\"confirmed_bar_timestamp\":\"{{time}}\",\"side\":\"short\",\"event_type\":\"entry\",\"strategy_spec_hash\":\"${ir.strategy_spec_hash}\",\"confirmed\":true}")`,
  );
  const source = `${lines.join("\n")}\n`;
  if (
    source.length > 100_000 ||
    source.includes("lookahead_on") ||
    /\[-\d+\]/.test(source)
  )
    throw new Error("pine_static_policy_failed");
  let simulationSource: string | undefined;
  if (compatibility.simulation_status === "simulation_compatible") {
    const stopParam = `p_${sanitize(ir.exit.stop_param)}`,
      holdParam = `p_${sanitize(ir.exit.max_hold_param)}`;
    const simulationLogic = `var int entry_bar = na
if long_signal
    strategy.entry("Long", strategy.long)
    entry_bar := bar_index
if short_signal
    strategy.entry("Short", strategy.short)
    entry_bar := bar_index
if strategy.position_size > 0
    strategy.exit("Long stop", "Long", stop=strategy.position_avg_price - atr_visual * ${stopParam})
if strategy.position_size < 0
    strategy.exit("Short stop", "Short", stop=strategy.position_avg_price + atr_visual * ${stopParam})
if strategy.position_size != 0 and not na(entry_bar) and bar_index - entry_bar >= ${holdParam}
    strategy.close_all(comment="Time exit")
if strategy.position_size == 0
    entry_bar := na`;
    simulationSource = source
      .replace(
        `indicator("${displayName} visualization", overlay=true, max_labels_count=200)`,
        `strategy("${displayName} simulation", overlay=true, pyramiding=0, commission_type=strategy.commission.percent, commission_value=0.1, slippage=1)`,
      )
      .replace(
        'plotshape(long_signal, title="Long", style=shape.triangleup, location=location.belowbar, color=color.green)',
        `${simulationLogic}\nplotshape(long_signal, title="Long", style=shape.triangleup, location=location.belowbar, color=color.green)`,
      );
  }
  const files: Record<string, string> = {
    "strategy_visualization.pine": canonicalHash(source),
  };
  if (simulationSource)
    files["strategy_simulation.pine"] = canonicalHash(simulationSource);
  const manifest = {
    schema_version: "pine_export_manifest_v1",
    export_id: input.exportId,
    program_id: input.programId,
    strategy_spec_id: ir.strategy_spec_id,
    strategy_spec_hash: ir.strategy_spec_hash,
    pine_version: "v6",
    compiler_version: "pine_bridge_v1",
    generated_at: input.generatedAt,
    approval_state: "approved",
    files,
    source_sharing: "account_private",
  };
  const parity = {
    schema_version: "pine_parity_report_v1",
    comparison_source: "reference_evaluator",
    verdict: "provisional",
    reason: "No TradingView export has been compared.",
    matched: 0,
    missing: 0,
    extra: 0,
    direction_mismatches: 0,
    tolerance_policy: { timestamp_seconds: 0 },
  };
  const bundle = {
    source,
    simulation_source: simulationSource,
    manifest,
    compatibility,
    parity,
    strategy_spec_snapshot: ir,
    readme: `# TradingView setup

1. Open the exact symbol and timeframe recorded in the compatibility report.
2. Paste strategy_visualization.pine into Pine Editor, save it, and add it to the chart.
3. Match every bounded input to the approved Strategy Spec snapshot.
4. Create confirmed-bar alerts only after issuing a webhook credential in Research Desk.
5. Recreate the script and every alert whenever the spec, script, symbol, timeframe, session, or input changes.
6. Export matching signals and run parity before treating the visualization as semantically aligned.

strategy_simulation.pine is present only for the portable simulation subset. TradingView chart data, fills, costs, and broker emulator behavior are not Bulletproof engine evidence. Alerts are observation-only and cannot create orders or authorize deployment.
`,
  };
  return { ...bundle, bundle_hash: canonicalHash(bundle) };
}

export function compareSignals(
  engine: Array<Record<string, unknown>>,
  tradingview: Array<Record<string, unknown>>,
  context: Record<string, unknown>,
) {
  for (const key of [
    "symbol",
    "timeframe",
    "window_start",
    "window_end",
    "timezone",
    "session",
    "parameter_hash",
  ])
    if (!context[key]) throw new Error(`parity_context_missing:${key}`);
  const left = new Map(
    engine.map((item) => [
      String(item.timestamp),
      String(item.side).toLowerCase(),
    ]),
  );
  const right = new Map(
    tradingview.map((item) => [
      String(item.timestamp),
      String(item.side).toLowerCase(),
    ]),
  );
  const common = [...left.keys()].filter((timestamp) => right.has(timestamp));
  const directionMismatches = common
    .filter((timestamp) => left.get(timestamp) !== right.get(timestamp))
    .map((timestamp) => ({
      timestamp,
      engine_side: left.get(timestamp),
      tradingview_side: right.get(timestamp),
    }));
  const missing = [...left.keys()]
    .filter((timestamp) => !right.has(timestamp))
    .map((timestamp) => ({ timestamp, side: left.get(timestamp) }));
  const extra = [...right.keys()]
    .filter((timestamp) => !left.has(timestamp))
    .map((timestamp) => ({ timestamp, side: right.get(timestamp) }));
  const divergences = [...missing, ...extra, ...directionMismatches].sort(
    (a, b) => String(a.timestamp).localeCompare(String(b.timestamp)),
  );
  const report = {
    schema_version: "pine_parity_report_v1",
    comparison_source: "tradingview_export",
    ...context,
    engine_signal_count: engine.length,
    tradingview_signal_count: tradingview.length,
    matched: common.length - directionMismatches.length,
    missing,
    extra,
    direction_mismatches: directionMismatches,
    first_divergence: divergences[0] ?? null,
    tolerance_policy: { timestamp_seconds: 0 },
    verdict: divergences.length ? "divergent" : "verified",
  };
  return { ...report, report_hash: canonicalHash(report) };
}
export function evaluatePortableSignals(
  ir: ReturnType<typeof normalizePortableIr>,
  rows: Array<Record<string, unknown>>,
) {
  const values: Record<string, Array<number | undefined>> = {};
  for (const feature of ir.features) {
    const source = rows.map((row) =>
        Number(row[String(feature.source_field ?? "close")] ?? 0),
      ),
      window = Number(feature.window ?? 1),
      base: Array<number | undefined> = [],
      computed: Array<number | undefined> = [];
    for (let index = 0; index < source.length; index++) {
      const transform = String(feature.transform);
      let result: number | undefined;
      if (transform === "identity") result = source[index];
      else if (transform === "return")
        result =
          index && source[index - 1]
            ? (source[index] - source[index - 1]) / source[index - 1]
            : undefined;
      else if (transform === "sma")
        result =
          index + 1 >= window
            ? source
                .slice(index - window + 1, index + 1)
                .reduce((a, b) => a + b, 0) / window
            : undefined;
      else if (transform === "ema")
        result =
          base.length && base[base.length - 1] !== undefined
            ? source[index] * (2 / (window + 1)) +
              base[base.length - 1]! * (1 - 2 / (window + 1))
            : source[index];
      else throw new Error(`portable_reference_unsupported:${transform}`);
      base.push(result);
      const lag = Number(feature.lag ?? 0);
      computed.push(
        lag ? (index >= lag ? base[index - lag] : undefined) : result,
      );
    }
    values[String(feature.id)] = computed;
  }
  return rows.flatMap((row, index) => {
    const passed = ir.gates.every((gate) => {
      const left = values[String(gate.left ?? gate.field)]?.[index],
        parameter = ir.parameters[String(gate.right_param ?? gate.param)],
        right =
          gate.right ?? (Array.isArray(parameter) ? parameter[0] : parameter);
      if (left === undefined || right === undefined) return false;
      const a = Number(left),
        b = Number(right);
      return gate.op === ">"
        ? a > b
        : gate.op === ">="
          ? a >= b
          : gate.op === "<"
            ? a < b
            : gate.op === "<="
              ? a <= b
              : gate.op === "===" || gate.op === "=="
                ? a === b
                : false;
    });
    return passed
      ? [
          {
            timestamp: row.timestamp,
            side: Number(row.close) >= Number(row.open) ? "long" : "short",
          },
        ]
      : [];
  });
}
export function parseRestrictedPine(source: string) {
  if (Buffer.byteLength(source) > 200_000)
    throw new Error("pine_source_too_large");
  const version = source.match(/\/\/@version=(\d+)/)?.[1];
  const rejected = [
    "strategy(",
    "strategy.entry",
    "strategy.order",
    "strategy.exit",
    "request.security",
    "request.seed",
    "import ",
    "library(",
    "array.",
    "map.",
    "matrix.",
  ].filter((token) => source.includes(token));
  const allowedCalls = new Set([
    "indicator",
    "input.float",
    "input.int",
    "input.bool",
    "ta.sma",
    "ta.ema",
    "ta.atr",
    "plot",
    "plotshape",
    "alertcondition",
  ]);
  for (const match of source.matchAll(/\b([A-Za-z_][A-Za-z0-9_.]*)\s*\(/g))
    if (
      !allowedCalls.has(match[1]) &&
      !rejected.includes(`unsupported_call:${match[1]}`)
    )
      rejected.push(`unsupported_call:${match[1]}`);
  const report = {
    schema_version: "pine_import_report_v1",
    source_checksum: canonicalHash(source),
    detected_pine_version: version ? `v${version}` : "unknown",
    supported_ast_nodes: [
      "indicator(",
      "input.float",
      "input.int",
      "input.bool",
      "ta.sma",
      "ta.ema",
      "ta.atr",
      "plotshape",
      "alertcondition",
    ].filter((token) => source.includes(token)),
    rejected_constructs: rejected,
    extracted_parameters: [
      ...source.matchAll(/input\.float\(([-+0-9.eE]+),\s*["']([^"']+)/g),
    ].map((match) => ({ name: match[2], default: Number(match[1]) })),
    extracted_signals: ["long_signal", "short_signal"].filter((item) =>
      source.includes(item),
    ),
    ambiguities: [
      "Pine execution and chart-data semantics require confirmation.",
    ],
    draft_spec_status: rejected.length || version !== "6" ? "blocked" : "draft",
  };
  return { ...report, report_hash: canonicalHash(report) };
}
