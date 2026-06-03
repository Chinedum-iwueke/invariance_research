import { createHash, randomUUID } from "node:crypto";
import type { AnalysisRecord, PropEvaluationDiagnostic, PropEvaluationRuleStatus, ScoreBand } from "@/lib/contracts";
import type { AnalysisEntity } from "@/lib/server/analysis/models";
import type { CanonicalTradeRecord, ParsedArtifact, PropEvaluationRulesV1 } from "@/lib/server/ingestion";
import { recordEvidenceEvent } from "@/lib/server/evidence/evidence-events";
import { getDb } from "@/lib/server/persistence/database";
import { getPostgresPool } from "@/lib/server/persistence/postgres";
import { getDatabaseProvider } from "@/lib/server/persistence/provider";
import { getCoreRepositories } from "@/lib/server/persistence/repositories";

type NormalizedRules = Required<Pick<
  PropEvaluationRulesV1,
  "source" | "label" | "account_size" | "profit_target_pct" | "max_total_drawdown_pct" | "total_drawdown_basis" | "max_daily_loss_pct" | "daily_loss_basis" | "reset_timezone" | "minimum_trading_days"
>> & PropEvaluationRulesV1 & { schema_version: "prop_evaluation_rules_v1"; rules_hash: string };

type PropEvaluationRuntimeContext = {
  account_size?: number;
  risk_per_trade_pct?: number;
};

type PropEvaluationResultRecord = {
  result_id: string;
  analysis_id: string;
  account_id: string;
  rule_snapshot_id: string;
  status: string;
  verdict: string;
  first_breach?: Record<string, unknown> | null;
  rule_status: PropEvaluationRuleStatus[];
  target_progress: Record<string, unknown>;
  summary_metrics: Record<string, unknown>;
  limitation_codes: string[];
  engine_payload_hash: string;
  created_at: string;
};

const FALLBACK_RULES: PropEvaluationRulesV1 = {
  schema_version: "prop_evaluation_rules_v1",
  source: "fallback",
  label: "Default prop evaluation",
  firm_label: "Generic prop firm",
  account_size: 100000,
  profit_target_pct: 0.08,
  max_total_drawdown_pct: 0.10,
  total_drawdown_basis: "static",
  max_daily_loss_pct: 0.05,
  daily_loss_basis: "closed_balance",
  reset_timezone: "UTC",
  minimum_trading_days: 5,
  maximum_evaluation_days: 30,
  consistency_max_day_profit_pct: 0.35,
};

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashJson(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function normalizePct(value: unknown, fallback: number): number {
  const numeric = typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
  return numeric > 1 ? numeric / 100 : numeric;
}

function normalizeOptionalPct(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined;
  return value > 1 ? value / 100 : value;
}

function mergeRuntimeRules(raw: PropEvaluationRulesV1 | Record<string, unknown> | null | undefined, runtimeContext?: PropEvaluationRuntimeContext) {
  return {
    ...(raw ?? {}),
    account_size: typeof (raw as Record<string, unknown> | undefined)?.account_size === "number"
      ? (raw as Record<string, unknown>).account_size
      : runtimeContext?.account_size,
  };
}

export function normalizePropEvaluationRules(raw?: PropEvaluationRulesV1 | Record<string, unknown> | null): NormalizedRules {
  const source = raw && typeof raw.source === "string" ? raw.source as NormalizedRules["source"] : "fallback";
  const rules = {
    ...FALLBACK_RULES,
    ...(raw ?? {}),
    schema_version: "prop_evaluation_rules_v1" as const,
    source,
    label: typeof raw?.label === "string" && raw.label.trim().length ? raw.label.trim() : FALLBACK_RULES.label,
    firm_label: typeof raw?.firm_label === "string" && raw.firm_label.trim().length ? raw.firm_label.trim() : FALLBACK_RULES.firm_label,
    account_size: typeof raw?.account_size === "number" && Number.isFinite(raw.account_size) && raw.account_size > 0 ? raw.account_size : FALLBACK_RULES.account_size,
    profit_target_pct: normalizePct(raw?.profit_target_pct, FALLBACK_RULES.profit_target_pct ?? 0.08),
    max_total_drawdown_pct: normalizePct(raw?.max_total_drawdown_pct, FALLBACK_RULES.max_total_drawdown_pct ?? 0.10),
    max_daily_loss_pct: normalizePct(raw?.max_daily_loss_pct, FALLBACK_RULES.max_daily_loss_pct ?? 0.05),
    total_drawdown_basis: raw?.total_drawdown_basis === "trailing_balance" || raw?.total_drawdown_basis === "trailing_equity" || raw?.total_drawdown_basis === "end_of_day_trailing"
      ? raw.total_drawdown_basis
      : FALLBACK_RULES.total_drawdown_basis,
    daily_loss_basis: raw?.daily_loss_basis === "intraday_equity" || raw?.daily_loss_basis === "end_of_day_balance"
      ? raw.daily_loss_basis
      : FALLBACK_RULES.daily_loss_basis,
    reset_timezone: typeof raw?.reset_timezone === "string" && raw.reset_timezone.trim().length ? raw.reset_timezone.trim() : "UTC",
    minimum_trading_days: typeof raw?.minimum_trading_days === "number" && Number.isFinite(raw.minimum_trading_days) && raw.minimum_trading_days > 0
      ? Math.round(raw.minimum_trading_days)
      : FALLBACK_RULES.minimum_trading_days,
    maximum_evaluation_days: typeof raw?.maximum_evaluation_days === "number" && Number.isFinite(raw.maximum_evaluation_days) && raw.maximum_evaluation_days > 0
      ? Math.round(raw.maximum_evaluation_days)
      : FALLBACK_RULES.maximum_evaluation_days,
    consistency_max_day_profit_pct: normalizePct(raw?.consistency_max_day_profit_pct, FALLBACK_RULES.consistency_max_day_profit_pct ?? 0.35),
    max_leverage: typeof raw?.max_leverage === "number" && Number.isFinite(raw.max_leverage) && raw.max_leverage > 0 ? raw.max_leverage : undefined,
  };
  return { ...rules, rules_hash: hashJson(rules) } as NormalizedRules;
}

function tradePnl(trade: CanonicalTradeRecord): number {
  if (typeof trade.pnl === "number" && Number.isFinite(trade.pnl)) return trade.pnl;
  const direction = trade.side === "short" ? -1 : 1;
  const gross = (trade.exit_price - trade.entry_price) * trade.quantity * direction;
  return gross - (trade.fees ?? 0);
}

function tradeDay(trade: CanonicalTradeRecord, index: number): string {
  const raw = trade.exit_time || trade.entry_time;
  const date = raw ? new Date(raw) : undefined;
  if (date && Number.isFinite(date.getTime())) return date.toISOString().slice(0, 10);
  return `trade_day_${index + 1}`;
}

function pct(value: number): number {
  return Number((value * 100).toFixed(4));
}

function formatPctValue(value: number | undefined): string {
  return value === undefined || !Number.isFinite(value) ? "Unavailable" : `${pct(value).toFixed(1)}%`;
}

function score(label: string, value: string, band: ScoreBand["band"]): ScoreBand {
  return { label, value, band };
}

type PropPathEvent = {
  rule: "profit_target" | "max_total_drawdown" | "max_daily_loss" | "consistency_max_day_profit";
  day?: string;
  trade_index?: number;
  observed_pct?: number;
  allowed_pct?: number;
  pnl?: number;
  cumulative_profit?: number;
  equity?: number;
};

type DailyPnlRow = {
  day: string;
  pnl: number;
  notional: number;
  trade_count: number;
  first_trade_index: number;
  last_trade_index: number;
};

type PropTradeStep = {
  day: string;
  trade_index: number;
  pnl: number;
  notional: number;
  symbol: string;
  exit_time: string;
  r_multiple?: number;
  pnl_pct?: number;
};

function buildTradeSteps(trades: CanonicalTradeRecord[]): PropTradeStep[] {
  return trades
    .map((trade, index) => {
      const notional = Math.abs(trade.entry_price * trade.quantity);
      return {
        day: tradeDay(trade, index),
        trade_index: index + 1,
        pnl: tradePnl(trade),
        notional: Number.isFinite(notional) ? notional : 0,
        symbol: trade.symbol,
        exit_time: trade.exit_time || trade.entry_time || "",
        r_multiple: typeof trade.r_multiple === "number" && Number.isFinite(trade.r_multiple)
          ? trade.r_multiple
          : typeof trade.risk_r === "number" && Number.isFinite(trade.risk_r)
            ? trade.risk_r
            : undefined,
        pnl_pct: typeof trade.pnl_pct === "number" && Number.isFinite(trade.pnl_pct) ? (Math.abs(trade.pnl_pct) > 1 ? trade.pnl_pct / 100 : trade.pnl_pct) : undefined,
      };
    })
    .sort((a, b) => {
      const timeOrder = a.exit_time.localeCompare(b.exit_time);
      return timeOrder || a.trade_index - b.trade_index;
    })
    .map((step, index) => ({ ...step, trade_index: index + 1 }));
}

function stepsToDailyRows(steps: PropTradeStep[]): DailyPnlRow[] {
  const rows = new Map<string, DailyPnlRow>();
  steps.forEach((step) => {
    const existing = rows.get(step.day);
    if (existing) {
      existing.pnl += step.pnl;
      existing.notional += step.notional;
      existing.trade_count += 1;
      existing.last_trade_index = step.trade_index;
    } else {
      rows.set(step.day, {
        day: step.day,
        pnl: step.pnl,
        notional: step.notional,
        trade_count: 1,
        first_trade_index: step.trade_index,
        last_trade_index: step.trade_index,
      });
    }
  });
  return [...rows.values()];
}

function stepsForCostStress(steps: PropTradeStep[], bpsPerRoundTrip: number): PropTradeStep[] {
  return steps.map((step) => ({
    ...step,
    pnl: step.pnl - (step.notional * bpsPerRoundTrip / 10_000),
  }));
}

function numericFromRecord(row: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = row[key] ?? row[key.toLowerCase()] ?? row[key.toUpperCase()];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const numeric = Number(value.replace(/[$,%\s]/g, ""));
      if (Number.isFinite(numeric)) return numeric;
    }
  }
  return undefined;
}

function stringFromRecord(row: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = row[key] ?? row[key.toLowerCase()] ?? row[key.toUpperCase()];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function buildEquityEvidence(parsedArtifact: ParsedArtifact, rules: NormalizedRules) {
  const rows = (parsedArtifact.equity_curve ?? [])
    .map((row, index) => {
      const timestamp = stringFromRecord(row, ["timestamp", "time", "date", "datetime", "ts"]) ?? `row_${index + 1}`;
      const equity = numericFromRecord(row, ["equity", "balance", "account_equity", "account_balance", "closed_balance", "nav", "value"]);
      const date = new Date(timestamp);
      return equity === undefined
        ? undefined
        : {
            timestamp,
            day: Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : timestamp.slice(0, 10),
            equity,
          };
    })
    .filter((row): row is { timestamp: string; day: string; equity: number } => Boolean(row))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  if (!rows.length) {
    return {
      quality: "closed_trade_only",
      row_count: 0,
      can_audit_intraday_daily_loss: false,
      max_intraday_loss_pct: null,
      max_close_to_close_loss_pct: null,
      note: "No usable equity curve rows were supplied; daily loss is reconstructed from closed-trade PnL.",
    };
  }

  const byDay = new Map<string, typeof rows>();
  rows.forEach((row) => byDay.set(row.day, [...(byDay.get(row.day) ?? []), row]));
  let maxIntradayLossPct = 0;
  let maxCloseToCloseLossPct = 0;
  let worstIntradayDay: string | null = null;
  let previousClose = rules.account_size;

  for (const [day, dayRows] of byDay.entries()) {
    const startEquity = dayRows[0]?.equity ?? previousClose;
    const minEquity = Math.min(...dayRows.map((row) => row.equity));
    const closeEquity = dayRows[dayRows.length - 1]?.equity ?? startEquity;
    const intradayLossPct = Math.max(0, (startEquity - minEquity) / Math.max(startEquity, 1));
    const closeLossPct = Math.max(0, (previousClose - closeEquity) / Math.max(previousClose, 1));
    if (intradayLossPct > maxIntradayLossPct) {
      maxIntradayLossPct = intradayLossPct;
      worstIntradayDay = day;
    }
    maxCloseToCloseLossPct = Math.max(maxCloseToCloseLossPct, closeLossPct);
    previousClose = closeEquity;
  }

  return {
    quality: rows.length >= 2 ? "equity_curve_backed" : "single_equity_point",
    row_count: rows.length,
    can_audit_intraday_daily_loss: rows.length > byDay.size,
    max_intraday_loss_pct: pct(maxIntradayLossPct),
    max_close_to_close_loss_pct: pct(maxCloseToCloseLossPct),
    worst_intraday_day: worstIntradayDay,
    note: rows.length > byDay.size
      ? "Equity curve contains multiple observations per day; intraday daily-loss pressure can be reviewed with higher confidence."
      : "Equity curve has one observation per day; daily-loss review remains close-to-close rather than true intraday.",
  };
}

function buildBrokerEvidence(parsedArtifact: ParsedArtifact) {
  const rows = parsedArtifact.broker_exports ?? [];
  if (!rows.length) {
    return {
      quality: "not_supplied",
      row_count: 0,
      fee_rows: 0,
      liquidity_rows: 0,
      avg_fee: null,
      note: "No broker/export fill file was supplied; execution realism remains assumption-led.",
    };
  }
  const fees = rows
    .map((row) => numericFromRecord(row, ["fee", "fees", "commission", "cost"]))
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const liquidityRows = rows.filter((row) => Boolean(stringFromRecord(row, ["liquidity", "maker_taker", "role"]))).length;
  return {
    quality: fees.length || liquidityRows ? "broker_context_available" : "raw_broker_rows_only",
    row_count: rows.length,
    fee_rows: fees.length,
    liquidity_rows: liquidityRows,
    avg_fee: fees.length ? Number((fees.reduce((sum, value) => sum + value, 0) / fees.length).toFixed(4)) : null,
    note: fees.length || liquidityRows
      ? "Broker/export rows include fee or liquidity context and can support stronger execution review."
      : "Broker/export rows were supplied but do not expose fee or liquidity fields.",
  };
}

function eventOrder(event: PropPathEvent | undefined): number {
  return event?.trade_index ?? Number.MAX_SAFE_INTEGER;
}

function evaluateTerminalOutcome(steps: PropTradeStep[], rules: NormalizedRules) {
  const path = evaluateTradePath(steps, rules);
  const firstBreach = earliestBreach(path.firstDailyBreach, path.firstTotalBreach, path.consistencyBreach);
  const targetBeforeBreach = Boolean(path.firstTargetHit && (!firstBreach || eventOrder(path.firstTargetHit) <= eventOrder(firstBreach)));
  const breachBeforeTarget = Boolean(firstBreach && (!path.firstTargetHit || eventOrder(firstBreach) < eventOrder(path.firstTargetHit)));
  return { path, firstBreach, targetBeforeBreach, breachBeforeTarget };
}

function buildStressScenarios(steps: PropTradeStep[], rules: NormalizedRules) {
  const scenarios = [0, 2, 5, 10, 20].map((bps) => {
    const stressedSteps = stepsForCostStress(steps, bps);
    const outcome = evaluateTerminalOutcome(stressedSteps, rules);
    const endingProfit = outcome.path.cumulative;
    const targetProfit = rules.account_size * rules.profit_target_pct;
    const status = outcome.targetBeforeBreach
      ? "target_before_breach"
      : outcome.breachBeforeTarget
        ? "breach_before_target"
        : "unresolved";
    return {
      scenario: bps === 0 ? "baseline" : `+${bps} bps round-trip cost`,
      bps_per_round_trip: bps,
      status,
      decisive_event: status === "target_before_breach"
        ? "target_reached_first"
        : status === "breach_before_target"
          ? "breach_happened_first"
          : "unresolved",
      decisive_day: status === "target_before_breach"
        ? outcome.path.firstTargetHit?.day ?? null
        : outcome.firstBreach?.day ?? null,
      target_hit_day: outcome.path.firstTargetHit?.day ?? null,
      target_hit_profit: outcome.path.firstTargetHit?.cumulative_profit ?? null,
      target_hit_profit_pct: outcome.path.firstTargetHit?.observed_pct ?? null,
      ending_profit: Number(endingProfit.toFixed(2)),
      ending_target_progress_pct: pct(targetProfit > 0 ? endingProfit / targetProfit : 0),
      peak_target_progress_pct: pct(targetProfit > 0 ? outcome.path.peakProfit / targetProfit : 0),
      first_breach_rule: outcome.firstBreach?.rule ?? null,
      first_breach_day: outcome.firstBreach?.day ?? null,
      max_daily_loss_pct: pct(outcome.path.maxDailyLossPct),
      max_total_drawdown_pct: pct(outcome.path.maxDrawdownPct),
    };
  });
  const breakEvenScenario = scenarios.find((scenario) => scenario.status !== "target_before_breach" && scenario.bps_per_round_trip > 0);
  return {
    scenarios,
    cost_break_point: breakEvenScenario?.scenario ?? "survives tested cost shocks",
  };
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function quantile(values: number[], q: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * q)));
  return sorted[index] ?? 0;
}

function shuffleSteps(steps: PropTradeStep[], random: () => number): PropTradeStep[] {
  const copy = steps.map((step, index) => ({ ...step, day: `sim_day_${index + 1}`, trade_index: index + 1 }));
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy.map((step, index) => ({ ...step, trade_index: index + 1 }));
}

function bootstrapSteps(steps: PropTradeStep[], random: () => number): PropTradeStep[] {
  return steps.map((_, index) => {
    const sampled = steps[Math.floor(random() * steps.length)] ?? steps[0]!;
    return { ...sampled, day: `sim_day_${index + 1}`, trade_index: index + 1 };
  });
}

function blockBootstrapByDay(steps: PropTradeStep[], random: () => number): PropTradeStep[] {
  const days = [...new Set(steps.map((step) => step.day))];
  const byDay = days.map((day) => steps.filter((step) => step.day === day));
  const sampled: PropTradeStep[] = [];
  for (let index = 0; index < byDay.length; index += 1) {
    const block = byDay[Math.floor(random() * byDay.length)] ?? [];
    block.forEach((step) => sampled.push({ ...step, day: `sim_day_${index + 1}` }));
  }
  return sampled.map((step, index) => ({ ...step, trade_index: index + 1 }));
}

function classifyFailure(outcome: ReturnType<typeof evaluateTerminalOutcome>): string {
  if (outcome.targetBeforeBreach) return "target_before_breach";
  const rule = outcome.firstBreach?.rule;
  if (rule === "max_daily_loss") return "daily_drawdown_breach";
  if (rule === "max_total_drawdown") return "max_drawdown_breach";
  if (rule === "consistency_max_day_profit") return "consistency_violation";
  return "target_not_reached";
}

function buildPropMonteCarlo(steps: PropTradeStep[], rules: NormalizedRules) {
  const dayCount = new Set(steps.map((step) => step.day)).size;
  const iterations = steps.length >= 2 ? 1000 : 0;
  if (!iterations) {
    return {
      iterations,
      target_before_breach_probability: null,
      breach_before_target_probability: null,
      unresolved_probability: null,
      median_ending_profit: null,
      p10_ending_profit: null,
      p95_max_total_drawdown_pct: null,
      failure_mode_breakdown: [],
      methods: [],
      note: "Monte Carlo prop survival requires at least two trading days.",
    };
  }
  const random = seededRandom(Number.parseInt(hashJson({ steps, rules: rules.rules_hash }).slice(0, 8), 16));
  let targetBeforeBreach = 0;
  let breachBeforeTarget = 0;
  let unresolved = 0;
  const endingProfits: number[] = [];
  const maxDrawdowns: number[] = [];
  const failures = new Map<string, number>();

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const method = iteration % 3;
    const sampledSteps = method === 0
      ? shuffleSteps(steps, random)
      : method === 1
        ? bootstrapSteps(steps, random)
        : dayCount >= 2
          ? blockBootstrapByDay(steps, random)
          : bootstrapSteps(steps, random);
    const outcome = evaluateTerminalOutcome(sampledSteps, rules);
    if (outcome.targetBeforeBreach) targetBeforeBreach += 1;
    else if (outcome.breachBeforeTarget) breachBeforeTarget += 1;
    else unresolved += 1;
    const failureMode = classifyFailure(outcome);
    failures.set(failureMode, (failures.get(failureMode) ?? 0) + 1);
    endingProfits.push(outcome.path.cumulative);
    maxDrawdowns.push(pct(outcome.path.maxDrawdownPct));
  }

  return {
    iterations,
    target_before_breach_probability: Number((targetBeforeBreach / iterations).toFixed(4)),
    breach_before_target_probability: Number((breachBeforeTarget / iterations).toFixed(4)),
    unresolved_probability: Number((unresolved / iterations).toFixed(4)),
    median_ending_profit: Number(quantile(endingProfits, 0.5).toFixed(2)),
    p10_ending_profit: Number(quantile(endingProfits, 0.1).toFixed(2)),
    p95_max_total_drawdown_pct: Number(quantile(maxDrawdowns, 0.95).toFixed(2)),
    failure_mode_breakdown: [...failures.entries()]
      .map(([mode, count]) => ({ mode, count, probability: Number((count / iterations).toFixed(4)) }))
      .sort((a, b) => b.count - a.count),
    methods: dayCount >= 2 ? ["trade_shuffle", "bootstrap_with_replacement", "day_block_bootstrap"] : ["trade_shuffle", "bootstrap_with_replacement"],
    note: "Deterministic trade-sequence simulations estimate whether order, replacement sampling, and day-block clustering change target-before-breach survival.",
  };
}

function buildDecisionCard(input: {
  verdict: string;
  fallbackLimited: boolean;
  dayCountLimited: boolean;
  targetReached: boolean;
  firstBreach: PropPathEvent | null;
  monteCarlo: ReturnType<typeof buildPropMonteCarlo>;
  stress: ReturnType<typeof buildStressScenarios>;
  equityEvidence: ReturnType<typeof buildEquityEvidence>;
  brokerEvidence: ReturnType<typeof buildBrokerEvidence>;
}) {
  const targetProbability = input.monteCarlo.target_before_breach_probability;
  const baseline = input.stress.scenarios[0];
  const stressedFailure = input.stress.scenarios.find((scenario) => scenario.bps_per_round_trip > 0 && scenario.status !== "target_before_breach");
  const blockers: string[] = [];
  if (input.fallbackLimited) blockers.push("Exact prop rules were not supplied.");
  if (input.dayCountLimited) blockers.push("Trading-day count does not match the configured evaluation contract.");
  if (input.firstBreach) blockers.push(`First breach is ${input.firstBreach.rule.replaceAll("_", " ")} on ${input.firstBreach.day ?? "an unknown day"}.`);
  if (targetProbability !== null && targetProbability < 0.5) blockers.push("Sequence simulation shows target-before-breach survival below 50%.");
  if (stressedFailure) blockers.push(`Cost stress fails at ${stressedFailure.scenario}.`);
  if (!input.equityEvidence.can_audit_intraday_daily_loss) blockers.push("Intraday daily-loss enforcement is not fully auditable from the submitted evidence.");
  if (input.brokerEvidence.quality === "not_supplied") blockers.push("Broker/fill evidence was not supplied for execution-cost verification.");

  const readiness = input.firstBreach || (targetProbability !== null && targetProbability < 0.5)
    ? "not_ready"
    : input.fallbackLimited || input.dayCountLimited || stressedFailure
      ? "conditional"
      : input.targetReached || baseline?.status === "target_before_breach"
        ? "challenge_ready_with_caveats"
        : "needs_more_edge";

  return {
    readiness,
    headline: readiness === "challenge_ready_with_caveats"
      ? "Candidate is challenge-ready under submitted rules, with live-execution caveats."
      : readiness === "conditional"
        ? "Candidate is conditionally viable, but evidence or stress failures must be resolved first."
        : readiness === "needs_more_edge"
          ? "No breach was detected, but the submitted path has not demonstrated enough target progress."
          : "Do not attempt the evaluation without rule, sizing, or execution changes.",
    confidence: input.equityEvidence.can_audit_intraday_daily_loss && input.brokerEvidence.quality !== "not_supplied" && !input.fallbackLimited ? "high" : input.fallbackLimited ? "low" : "medium",
    blockers,
  };
}

function buildImprovementTargets(input: {
  rules: NormalizedRules;
  totalProfit: number;
  firstBreach: PropPathEvent | null;
  path: ReturnType<typeof evaluateTradePath>;
}) {
  const targetProfit = input.rules.account_size * input.rules.profit_target_pct;
  const profitShortfall = Math.max(0, targetProfit - input.totalProfit);
  const totalDrawdownBuffer = Math.max(0, pct(input.rules.max_total_drawdown_pct) - pct(input.path.maxDrawdownPct));
  const dailyLossBuffer = Math.max(0, pct(input.rules.max_daily_loss_pct) - pct(input.path.maxDailyLossPct));
  const requiredRiskReductionPct = input.firstBreach?.observed_pct && input.firstBreach.allowed_pct
    ? Math.max(0, Number((((input.firstBreach.observed_pct - input.firstBreach.allowed_pct) / input.firstBreach.observed_pct) * 100).toFixed(1)))
    : 0;
  return {
    profit_shortfall_to_target: Number(profitShortfall.toFixed(2)),
    total_drawdown_buffer_pct: Number(totalDrawdownBuffer.toFixed(2)),
    daily_loss_buffer_pct: Number(dailyLossBuffer.toFixed(2)),
    risk_reduction_needed_to_clear_first_breach_pct: requiredRiskReductionPct,
  };
}

function buildLossClusterAnalysis(steps: PropTradeStep[]) {
  let currentLossRun = 0;
  let maxConsecutiveLosses = 0;
  let currentLossPnl = 0;
  let worstLossRunPnl = 0;
  steps.forEach((step) => {
    if (step.pnl < 0) {
      currentLossRun += 1;
      currentLossPnl += step.pnl;
      maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentLossRun);
      worstLossRunPnl = Math.min(worstLossRunPnl, currentLossPnl);
    } else {
      currentLossRun = 0;
      currentLossPnl = 0;
    }
  });

  function worstRollingLoss(windowSize: number) {
    if (steps.length < windowSize) return null;
    let worst = 0;
    let startIndex = 0;
    for (let index = 0; index <= steps.length - windowSize; index += 1) {
      const slice = steps.slice(index, index + windowSize);
      const pnl = slice.reduce((sum, step) => sum + step.pnl, 0);
      if (pnl < worst) {
        worst = pnl;
        startIndex = index;
      }
    }
    return {
      window_size: windowSize,
      pnl: Number(worst.toFixed(2)),
      start_trade_index: steps[startIndex]?.trade_index ?? null,
      end_trade_index: steps[startIndex + windowSize - 1]?.trade_index ?? null,
      start_day: steps[startIndex]?.day ?? null,
      end_day: steps[startIndex + windowSize - 1]?.day ?? null,
    };
  }

  const byDay = stepsToDailyRows(steps);
  const worstDay = [...byDay].sort((a, b) => a.pnl - b.pnl)[0];
  return {
    max_consecutive_losses: maxConsecutiveLosses,
    worst_loss_run_pnl: Number(worstLossRunPnl.toFixed(2)),
    worst_three_trade_cluster: worstRollingLoss(3),
    worst_five_trade_cluster: worstRollingLoss(5),
    worst_day: worstDay ? {
      day: worstDay.day,
      pnl: Number(worstDay.pnl.toFixed(2)),
      trade_count: worstDay.trade_count,
      first_trade_index: worstDay.first_trade_index,
      last_trade_index: worstDay.last_trade_index,
    } : null,
  };
}

function buildRiskSensitivity(steps: PropTradeStep[], rules: NormalizedRules, runtimeContext?: PropEvaluationRuntimeContext) {
  const riskLevels = [0.0025, 0.005, 0.0075, 0.01, 0.015, 0.02];
  const hasRMultiples = steps.every((step) => typeof step.r_multiple === "number" && Number.isFinite(step.r_multiple));
  const hasPnlPct = steps.every((step) => typeof step.pnl_pct === "number" && Number.isFinite(step.pnl_pct));
  const runtimeRiskPct = normalizeOptionalPct(runtimeContext?.risk_per_trade_pct);

  if (!hasRMultiples && !hasPnlPct && !runtimeRiskPct) {
    return {
      status: "unavailable",
      basis: "missing_r_multiple_pnl_pct_or_runtime_risk",
      rows: [],
      best_range: null,
      note: "Risk-per-trade sensitivity requires risk_R/r_multiple, complete pnl_pct values, or a runtime risk-per-trade assumption. The page omits sizing claims rather than guessing the submitted path's baseline risk.",
    };
  }

  const rows = riskLevels.map((riskPct) => {
    const sizedSteps = steps.map((step, index) => {
      const pnl = hasRMultiples
        ? (step.r_multiple ?? 0) * riskPct * rules.account_size
        : hasPnlPct
          ? ((step.pnl_pct ?? 0) / 0.01) * riskPct * rules.account_size
          : step.pnl * (riskPct / (runtimeRiskPct ?? riskPct));
      return {
        ...step,
        pnl,
        notional: step.notional * (riskPct / 0.01),
        trade_index: index + 1,
      };
    });
    const outcome = evaluateTerminalOutcome(sizedSteps, rules);
    const failureMode = classifyFailure(outcome);
    const targetProfit = rules.account_size * rules.profit_target_pct;
    return {
      risk_per_trade_pct: pct(riskPct),
      outcome: outcome.targetBeforeBreach ? "target_before_breach" : outcome.breachBeforeTarget ? "breach_before_target" : "unresolved",
      failure_mode: failureMode,
      first_breach_rule: outcome.firstBreach?.rule ?? null,
      first_breach_day: outcome.firstBreach?.day ?? null,
      target_hit_day: outcome.path.firstTargetHit?.day ?? null,
      ending_profit: Number(outcome.path.cumulative.toFixed(2)),
      peak_target_progress_pct: pct(targetProfit > 0 ? outcome.path.peakProfit / targetProfit : 0),
      max_daily_loss_pct: pct(outcome.path.maxDailyLossPct),
      max_total_drawdown_pct: pct(outcome.path.maxDrawdownPct),
    };
  });

  const passing = rows.filter((row) => row.outcome === "target_before_breach");
  const status = hasRMultiples ? "r_multiple_backed" : hasPnlPct ? "pnl_pct_scaled" : "runtime_risk_scaled";
  const basis = hasRMultiples ? "risk_R/r_multiple" : hasPnlPct ? "pnl_pct scaled to requested risk levels" : "submitted PnL scaled from runtime risk_per_trade_pct";
  return {
    status,
    basis,
    rows,
    best_range: passing.length
      ? `${passing[0]!.risk_per_trade_pct.toFixed(2)}%-${passing[passing.length - 1]!.risk_per_trade_pct.toFixed(2)}%`
      : null,
    note: hasRMultiples
      ? "Risk map is computed from trade R-multiples and configured account size."
      : hasPnlPct
        ? "Risk map uses pnl_pct as a per-trade return proxy. Upload risk_R/r_multiple for decision-grade risk-per-trade sizing."
        : "Risk map scales the submitted PnL path from the runtime risk-per-trade assumption. Upload risk_R/r_multiple for decision-grade per-trade sizing.",
  };
}

function evaluateTradePath(steps: PropTradeStep[], rules: NormalizedRules) {
  const accountSize = rules.account_size;
  const targetProfit = accountSize * rules.profit_target_pct;
  let cumulative = 0;
  let highWater = accountSize;
  let maxDrawdownPct = 0;
  let maxDailyLossPct = 0;
  let currentDay: string | undefined;
  let dayStartEquity = accountSize;
  let dayClosedPnl = 0;
  let firstTotalBreach: PropPathEvent | undefined;
  let firstDailyBreach: PropPathEvent | undefined;
  let firstTargetHit: PropPathEvent | undefined;
  let peakProfit = 0;
  let peakProfitDay: string | undefined;
  let peakProfitTradeIndex: number | undefined;
  const breachEvents: PropPathEvent[] = [];
  const targetEvents: PropPathEvent[] = [];
  const dayPnl = new Map<string, number>();

  steps.forEach((step) => {
    if (currentDay !== step.day) {
      currentDay = step.day;
      dayStartEquity = accountSize + cumulative;
      dayClosedPnl = 0;
    }

    dayClosedPnl += step.pnl;
    dayPnl.set(step.day, (dayPnl.get(step.day) ?? 0) + step.pnl);
    cumulative += step.pnl;
    const equity = accountSize + cumulative;
    if (cumulative > peakProfit) {
      peakProfit = cumulative;
      peakProfitDay = step.day;
      peakProfitTradeIndex = step.trade_index;
    }
    highWater = Math.max(highWater, equity);

    const totalDrawdownBasis = rules.total_drawdown_basis === "static" ? accountSize : highWater;
    const totalDrawdownAmount = Math.max(0, totalDrawdownBasis - equity);
    const totalDrawdownPct = totalDrawdownAmount / accountSize;
    maxDrawdownPct = Math.max(maxDrawdownPct, totalDrawdownPct);
    if (!firstTotalBreach && totalDrawdownPct > rules.max_total_drawdown_pct) {
      firstTotalBreach = {
        rule: "max_total_drawdown",
        day: step.day,
        trade_index: step.trade_index,
        observed_pct: pct(totalDrawdownPct),
        allowed_pct: pct(rules.max_total_drawdown_pct),
        cumulative_profit: Number(cumulative.toFixed(2)),
        equity: Number(equity.toFixed(2)),
      };
      breachEvents.push(firstTotalBreach);
    }

    const dailyLossBasis = rules.daily_loss_basis === "closed_balance" ? Math.max(dayStartEquity, 1) : accountSize;
    const dailyLossAmount = Math.max(0, -dayClosedPnl);
    const dailyLossPct = dailyLossAmount / dailyLossBasis;
    maxDailyLossPct = Math.max(maxDailyLossPct, dailyLossPct);
    if (!firstDailyBreach && dailyLossPct > rules.max_daily_loss_pct) {
      firstDailyBreach = {
        rule: "max_daily_loss",
        day: step.day,
        trade_index: step.trade_index,
        observed_pct: pct(dailyLossPct),
        allowed_pct: pct(rules.max_daily_loss_pct),
        pnl: Number(dayClosedPnl.toFixed(2)),
        cumulative_profit: Number(cumulative.toFixed(2)),
      };
      breachEvents.push(firstDailyBreach);
    }

    if (!firstTargetHit && cumulative >= targetProfit) {
      firstTargetHit = {
        rule: "profit_target",
        day: step.day,
        trade_index: step.trade_index,
        observed_pct: pct(cumulative / accountSize),
        allowed_pct: pct(rules.profit_target_pct),
        cumulative_profit: Number(cumulative.toFixed(2)),
        equity: Number(equity.toFixed(2)),
      };
      targetEvents.push(firstTargetHit);
    }
  });

  const rows = stepsToDailyRows(steps);
  const largestDayProfit = Math.max(0, ...[...dayPnl.values()]);
  const consistencyLimitPct = rules.consistency_max_day_profit_pct;
  const consistencyApplicable = Boolean(consistencyLimitPct && cumulative > 0 && largestDayProfit > 0);
  const consistencyShare = consistencyApplicable ? largestDayProfit / cumulative : 0;
  const consistencyBreach = consistencyApplicable && consistencyLimitPct && consistencyShare > consistencyLimitPct
    ? ({
        rule: "consistency_max_day_profit",
        day: rows[rows.length - 1]?.day,
        trade_index: rows[rows.length - 1]?.last_trade_index,
        observed_pct: pct(consistencyShare),
        allowed_pct: pct(consistencyLimitPct),
        pnl: Number(largestDayProfit.toFixed(2)),
      } satisfies PropPathEvent)
    : undefined;

  return {
    cumulative,
    maxDrawdownPct,
    maxDailyLossPct,
    firstTotalBreach,
    firstDailyBreach,
    firstTargetHit,
    consistencyShare,
    consistencyApplicable,
    consistencyBreach,
    breachEvents: consistencyBreach ? [...breachEvents, consistencyBreach] : breachEvents,
    targetEvents,
    tradingDays: rows.length,
    peakProfit,
    peakProfitDay,
    peakProfitTradeIndex,
  };
}

function buildWindowOutcomes(steps: PropTradeStep[], rules: NormalizedRules) {
  const days = [...new Set(steps.map((step) => step.day))];
  const maxDays = Math.max(1, Math.min(rules.maximum_evaluation_days ?? days.length, days.length));
  const windows = days.map((_, startIndex) => {
    const windowDays = new Set(days.slice(startIndex, startIndex + maxDays));
    const windowSteps = steps
      .filter((step) => windowDays.has(step.day))
      .map((step, index) => ({ ...step, trade_index: index + 1 }));
    const path = evaluateTradePath(windowSteps, rules);
    const firstBreach = earliestBreach(path.firstDailyBreach, path.firstTotalBreach, path.consistencyBreach);
    const targetBeforeBreach = Boolean(path.firstTargetHit && (!firstBreach || ((path.firstTargetHit.trade_index ?? Number.MAX_SAFE_INTEGER) <= (firstBreach.trade_index ?? Number.MAX_SAFE_INTEGER))));
    const breachBeforeTarget = Boolean(firstBreach && (!path.firstTargetHit || ((firstBreach.trade_index ?? Number.MAX_SAFE_INTEGER) < (path.firstTargetHit.trade_index ?? Number.MAX_SAFE_INTEGER))));
    const resolution = targetBeforeBreach ? path.firstTargetHit : breachBeforeTarget ? firstBreach : undefined;
    return {
      start_day: windowSteps[0]?.day,
      end_day: windowSteps[windowSteps.length - 1]?.day,
      trading_days: new Set(windowSteps.map((step) => step.day)).size,
      trade_count: windowSteps.length,
      outcome: targetBeforeBreach ? "target_before_breach" : breachBeforeTarget ? "breach_before_target" : "unresolved",
      resolution_day: resolution?.day,
      resolution_trade_index: resolution?.trade_index,
      resolution_rule: resolution?.rule,
      target_hit_day: path.firstTargetHit?.day,
      target_hit_trade_index: path.firstTargetHit?.trade_index,
      target_hit_profit: path.firstTargetHit?.cumulative_profit,
      target_hit_profit_pct: path.firstTargetHit?.observed_pct,
      breach_day: firstBreach?.day,
      breach_rule: firstBreach?.rule,
      breach_trade_index: firstBreach?.trade_index,
      breach_observed_pct: firstBreach?.observed_pct,
      breach_allowed_pct: firstBreach?.allowed_pct,
      breach_cumulative_profit: firstBreach?.cumulative_profit,
      breach_equity: firstBreach?.equity,
      profit: Number(path.cumulative.toFixed(2)),
      profit_pct: pct(path.cumulative / rules.account_size),
      peak_profit: Number(path.peakProfit.toFixed(2)),
      peak_profit_pct: pct(path.peakProfit / rules.account_size),
      peak_profit_day: path.peakProfitDay,
      max_daily_loss_pct: pct(path.maxDailyLossPct),
      max_total_drawdown_pct: pct(path.maxDrawdownPct),
    };
  });

  return {
    target_before_breach_count: windows.filter((window) => window.outcome === "target_before_breach").length,
    breach_before_target_count: windows.filter((window) => window.outcome === "breach_before_target").length,
    unresolved_count: windows.filter((window) => window.outcome === "unresolved").length,
    windows,
  };
}

function earliestBreach(...events: Array<PropPathEvent | undefined>): PropPathEvent | undefined {
  return events
    .filter((event): event is PropPathEvent => Boolean(event))
    .sort((a, b) => (a.trade_index ?? Number.MAX_SAFE_INTEGER) - (b.trade_index ?? Number.MAX_SAFE_INTEGER))[0];
}

export function computePropEvaluationReadiness(
  parsedArtifact: ParsedArtifact,
  rawRules?: PropEvaluationRulesV1 | Record<string, unknown> | null,
  runtimeContext?: PropEvaluationRuntimeContext,
): PropEvaluationDiagnostic {
  const rules = normalizePropEvaluationRules(mergeRuntimeRules(rawRules ?? parsedArtifact.prop_evaluation_rules, runtimeContext));
  const accountSize = rules.account_size;
  const tradeSteps = buildTradeSteps(parsedArtifact.trades);
  const dailyRows = stepsToDailyRows(tradeSteps);
  const path = evaluateTradePath(tradeSteps, rules);
  const totalProfit = path.cumulative;
  const targetProfit = accountSize * rules.profit_target_pct;
  const targetReached = totalProfit >= targetProfit;
  const tradingDays = path.tradingDays;
  const firstBreach = earliestBreach(path.firstDailyBreach, path.firstTotalBreach, path.consistencyBreach) ?? null;
  const windowOutcomes = buildWindowOutcomes(tradeSteps, rules);
  const equityEvidence = buildEquityEvidence(parsedArtifact, rules);
  const brokerEvidence = buildBrokerEvidence(parsedArtifact);
  const stressTest = buildStressScenarios(tradeSteps, rules);
  const propMonteCarlo = buildPropMonteCarlo(tradeSteps, rules);
  const riskSensitivity = buildRiskSensitivity(tradeSteps, rules, runtimeContext);
  const lossClusterAnalysis = buildLossClusterAnalysis(tradeSteps);
  const dayCountLimited = tradingDays < rules.minimum_trading_days || Boolean(rules.maximum_evaluation_days && tradingDays > rules.maximum_evaluation_days);
  const fallbackLimited = rules.source === "fallback";
  const status = fallbackLimited || dayCountLimited ? "limited" : "available";
  const verdict = firstBreach
    ? "breach_risk"
    : targetReached && !dayCountLimited
      ? "pass_ready"
      : "target_not_reached";
  const consistencyRuleConfigured = Boolean(rules.consistency_max_day_profit_pct);
  const consistencyStatus: PropEvaluationRuleStatus["status"] = !consistencyRuleConfigured
    ? "limited"
    : !path.consistencyApplicable
      ? "limited"
      : path.consistencyBreach
        ? "fail"
        : "pass";
  const ruleStatus: PropEvaluationRuleStatus[] = [
    { rule: "profit_target", status: targetReached ? "pass" : "fail", observed: pct(totalProfit / accountSize), allowed: pct(rules.profit_target_pct) },
    { rule: "max_total_drawdown", status: path.firstTotalBreach ? "fail" : "pass", observed: pct(path.maxDrawdownPct), allowed: pct(rules.max_total_drawdown_pct) },
    { rule: "max_daily_loss", status: path.firstDailyBreach ? "fail" : "pass", observed: pct(path.maxDailyLossPct), allowed: pct(rules.max_daily_loss_pct) },
    { rule: "minimum_trading_days", status: tradingDays >= rules.minimum_trading_days ? "pass" : "limited", observed: tradingDays, allowed: rules.minimum_trading_days },
    { rule: "maximum_evaluation_days", status: rules.maximum_evaluation_days && tradingDays > rules.maximum_evaluation_days ? "fail" : "pass", observed: tradingDays, allowed: rules.maximum_evaluation_days ?? null },
    { rule: "consistency_max_day_profit", status: consistencyStatus, observed: path.consistencyApplicable ? pct(path.consistencyShare) : null, allowed: rules.consistency_max_day_profit_pct ? pct(rules.consistency_max_day_profit_pct) : null },
  ];
  const targetProgress = {
    ending_profit: Number(totalProfit.toFixed(2)),
    target_profit: Number(targetProfit.toFixed(2)),
    ending_progress_pct: pct(targetProfit > 0 ? totalProfit / targetProfit : 0),
    peak_profit: Number(path.peakProfit.toFixed(2)),
    peak_progress_pct: pct(targetProfit > 0 ? path.peakProfit / targetProfit : 0),
    peak_profit_day: path.peakProfitDay ?? null,
    trading_days: tradingDays,
    first_target_hit: path.firstTargetHit ?? null,
    target_before_breach_count: windowOutcomes.target_before_breach_count,
    breach_before_target_count: windowOutcomes.breach_before_target_count,
    unresolved_window_count: windowOutcomes.unresolved_count,
  };
  const summaryMetrics = {
    target_before_breach_probability: windowOutcomes.windows.length ? windowOutcomes.target_before_breach_count / windowOutcomes.windows.length : 0,
    breach_probability: windowOutcomes.windows.length ? windowOutcomes.breach_before_target_count / windowOutcomes.windows.length : 0,
    max_daily_loss_observed: path.maxDailyLossPct,
    max_daily_loss_allowed: rules.max_daily_loss_pct,
    max_total_drawdown_observed: path.maxDrawdownPct,
    max_total_drawdown_allowed: rules.max_total_drawdown_pct,
    profit_progress_pct: targetProfit > 0 ? totalProfit / targetProfit : 0,
    trading_days: tradingDays,
  };
  const decisionCard = buildDecisionCard({
    verdict,
    fallbackLimited,
    dayCountLimited,
    targetReached,
    firstBreach,
    monteCarlo: propMonteCarlo,
    stress: stressTest,
    equityEvidence,
    brokerEvidence,
  });
  const improvementTargets = buildImprovementTargets({ rules, totalProfit, firstBreach, path });

  return {
    status,
    verdict,
    metrics: [
      score("Windows Reaching Target First", formatPctValue(summaryMetrics.target_before_breach_probability), firstBreach ? "elevated" : "moderate"),
      score("Breach Probability", formatPctValue(summaryMetrics.breach_probability), firstBreach ? "critical" : "moderate"),
      score("Peak Target Progress", `${targetProgress.peak_progress_pct.toFixed(1)}%`, path.firstTargetHit ? "good" : "moderate"),
      score(
        "MC Target-Before-Breach",
        propMonteCarlo.target_before_breach_probability === null ? "Unavailable" : formatPctValue(propMonteCarlo.target_before_breach_probability),
        propMonteCarlo.target_before_breach_probability === null
          ? "informational"
          : propMonteCarlo.target_before_breach_probability >= 0.7
            ? "good"
            : propMonteCarlo.target_before_breach_probability >= 0.45
              ? "moderate"
              : "critical",
      ),
      score("Max Daily Loss", `${pct(path.maxDailyLossPct).toFixed(1)}% / ${pct(rules.max_daily_loss_pct).toFixed(1)}%`, path.firstDailyBreach ? "critical" : "moderate"),
      score("Max Total Drawdown", `${pct(path.maxDrawdownPct).toFixed(1)}% / ${pct(rules.max_total_drawdown_pct).toFixed(1)}%`, path.firstTotalBreach ? "critical" : "moderate"),
      score("Trading Days", String(tradingDays), dayCountLimited ? "informational" : "moderate"),
    ],
    rule_snapshot: rules,
    rule_status: ruleStatus,
    first_breach: firstBreach,
    target_progress: targetProgress,
    interpretation: {
      title: "Prop evaluation interpretation",
      summary: firstBreach
        ? "This strategy would need rule or sizing changes before attempting the selected prop evaluation."
        : targetReached
          ? "This strategy is pass-ready under the selected prop evaluation rules, subject to live execution and intraday-loss caveats."
          : "This strategy has not reached the selected funding target yet, but no configured breach was detected.",
      bullets: [
        fallbackLimited ? "Fallback rules were used; replace them with the exact prop firm rule sheet before relying on the verdict." : "Exact runtime or saved rules were used for this run.",
        firstBreach ? `First breach: ${String(firstBreach.rule).replaceAll("_", " ")}.` : "No configured rule breach was detected.",
        `Peak profit target progress before the path ended: ${targetProgress.peak_progress_pct.toFixed(1)}%.`,
        `${windowOutcomes.target_before_breach_count} rolling evaluation window(s) reached target before breach; ${windowOutcomes.breach_before_target_count} breached before target.`,
        propMonteCarlo.target_before_breach_probability === null
          ? "Monte Carlo prop survival is unavailable because the path has fewer than two trading days."
          : `Monte Carlo target-before-breach survival is ${formatPctValue(propMonteCarlo.target_before_breach_probability)} over ${propMonteCarlo.iterations} deterministic shuffled paths.`,
      ],
    },
    assumptions: [
      `Account size: ${accountSize}.`,
      `Daily loss basis: ${rules.daily_loss_basis}.`,
      `Total drawdown basis: ${rules.total_drawdown_basis}.`,
    ],
    limitations: [
      ...(fallbackLimited ? ["Default fallback rules are not a substitute for the actual prop firm contract."] : []),
      "Closed-trade PnL is used when intraday equity or broker equity evidence is unavailable.",
      ...(equityEvidence.can_audit_intraday_daily_loss ? [] : ["Intraday daily loss remains limited unless the upload includes intraday equity/balance observations."]),
      ...(brokerEvidence.quality === "not_supplied" ? ["Broker/fill evidence was not supplied, so execution-cost verification remains assumption-led."] : []),
    ],
    recommendations: [
      firstBreach ? "Reduce risk per trade or add a daily stop before attempting evaluation." : "Keep the rule sheet saved with the analysis before sharing the verdict.",
      !targetReached ? "Improve profit target progress without increasing daily loss concentration." : "Re-test after any sizing, leverage, or trade-frequency change.",
      "Upload broker equity or intraday balance data to validate daily loss rules with higher precision.",
      stressTest.cost_break_point === "survives tested cost shocks" ? "Keep testing with broker-specific spread and commission data." : `Investigate execution sensitivity: ${stressTest.cost_break_point}.`,
    ],
    metadata: {
      summary_metrics: summaryMetrics,
      target_progress: targetProgress,
      rule_status: ruleStatus,
      breach_events: path.breachEvents,
      target_events: path.targetEvents,
      evaluation_windows: windowOutcomes.windows,
      evidence_grade: {
        equity: equityEvidence,
        broker: brokerEvidence,
        source_files: parsedArtifact.source_files?.map((file) => ({ path: file.path, role: file.role, recognized: file.recognized })) ?? [],
      },
      stress_test: stressTest,
      prop_monte_carlo: propMonteCarlo,
      risk_sensitivity: riskSensitivity,
      loss_cluster_analysis: lossClusterAnalysis,
      decision_card: decisionCard,
      improvement_targets: improvementTargets,
      runtime_context: {
        account_size: runtimeContext?.account_size ?? null,
        risk_per_trade_pct: runtimeContext?.risk_per_trade_pct ?? null,
      },
      data_quality_check: {
        trade_count: tradeSteps.length,
        trading_days: dailyRows.length,
        has_mae_mfe: parsedArtifact.trades.some((trade) => typeof trade.mae === "number" || typeof trade.mfe === "number"),
        has_risk_sizing_fields: parsedArtifact.trades.some((trade) => typeof trade.r_multiple === "number" || typeof trade.risk_r === "number") || Boolean(normalizeOptionalPct(runtimeContext?.risk_per_trade_pct)),
        has_pnl_pct: parsedArtifact.trades.some((trade) => typeof trade.pnl_pct === "number"),
        can_audit_intratrade_danger: parsedArtifact.trades.some((trade) => typeof trade.mae === "number" || typeof trade.mfe === "number"),
        note: parsedArtifact.trades.some((trade) => typeof trade.mae === "number" || typeof trade.mfe === "number")
          ? "MAE/MFE is present for at least some trades; intratrade danger can be discussed with caveats."
          : "No MAE/MFE was supplied; evaluator reports sequence feasibility but does not claim intratrade danger.",
      },
    },
  };
}

async function persistSnapshotAndResult(input: {
  analysis: AnalysisEntity;
  rules: NormalizedRules;
  diagnostic: PropEvaluationDiagnostic;
  userId: string;
}): Promise<{ rule_snapshot_id: string; result: PropEvaluationResultRecord }> {
  const createdAt = new Date().toISOString();
  const ruleSnapshotId = randomUUID();
  const result: PropEvaluationResultRecord = {
    result_id: randomUUID(),
    analysis_id: input.analysis.analysis_id,
    account_id: input.analysis.account_id,
    rule_snapshot_id: ruleSnapshotId,
    status: input.diagnostic.status ?? "limited",
    verdict: input.diagnostic.verdict,
    first_breach: input.diagnostic.first_breach,
    rule_status: input.diagnostic.rule_status,
    target_progress: input.diagnostic.target_progress ?? {},
    summary_metrics: (input.diagnostic.metadata?.summary_metrics as Record<string, unknown> | undefined) ?? {},
    limitation_codes: input.diagnostic.limitations ?? [],
    engine_payload_hash: hashJson(input.diagnostic),
    created_at: createdAt,
  };

  if (getDatabaseProvider() === "postgres") {
    const pool = getPostgresPool();
    await pool.query(
      `INSERT INTO prop_evaluation_rule_snapshots (rule_snapshot_id, analysis_id, account_id, profile_id, source, label, rules_json, rules_hash, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [ruleSnapshotId, input.analysis.analysis_id, input.analysis.account_id, null, input.rules.source, input.rules.label, JSON.stringify(input.rules), input.rules.rules_hash, createdAt],
    );
    await pool.query(
      `INSERT INTO prop_evaluation_results (result_id, analysis_id, account_id, rule_snapshot_id, status, verdict, first_breach_json, rule_status_json, target_progress_json, summary_metrics_json, limitation_codes_json, engine_payload_hash, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [result.result_id, result.analysis_id, result.account_id, result.rule_snapshot_id, result.status, result.verdict, JSON.stringify(result.first_breach ?? null), JSON.stringify(result.rule_status), JSON.stringify(result.target_progress), JSON.stringify(result.summary_metrics), JSON.stringify(result.limitation_codes), result.engine_payload_hash, result.created_at],
    );
  } else {
    const db = getDb();
    db.prepare(
      `INSERT INTO prop_evaluation_rule_snapshots (rule_snapshot_id, analysis_id, account_id, profile_id, source, label, rules_json, rules_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(ruleSnapshotId, input.analysis.analysis_id, input.analysis.account_id, null, input.rules.source, input.rules.label, JSON.stringify(input.rules), input.rules.rules_hash, createdAt);
    db.prepare(
      `INSERT INTO prop_evaluation_results (result_id, analysis_id, account_id, rule_snapshot_id, status, verdict, first_breach_json, rule_status_json, target_progress_json, summary_metrics_json, limitation_codes_json, engine_payload_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(result.result_id, result.analysis_id, result.account_id, result.rule_snapshot_id, result.status, result.verdict, JSON.stringify(result.first_breach ?? null), JSON.stringify(result.rule_status), JSON.stringify(result.target_progress), JSON.stringify(result.summary_metrics), JSON.stringify(result.limitation_codes), result.engine_payload_hash, result.created_at);
  }
  return { rule_snapshot_id: ruleSnapshotId, result };
}

export function mergePropDiagnostic(record: AnalysisRecord, diagnostic: PropEvaluationDiagnostic): AnalysisRecord {
  return {
    ...record,
    diagnostics: { ...record.diagnostics, prop_evaluation_readiness: diagnostic },
    engine_payload: {
      ...record.engine_payload,
      diagnostics: {
        ...record.engine_payload.diagnostics,
        prop_evaluation_readiness: {
          status: diagnostic.status,
          summary_metrics: diagnostic.metrics.map((metric, index) => ({
            key: metric.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || `metric_${index + 1}`,
            label: metric.label,
            value: metric.value,
            band: metric.band,
          })),
          figures: [],
          interpretation: diagnostic.interpretation.summary,
          assumptions: diagnostic.assumptions ?? [],
          warnings: [],
          recommendations: diagnostic.recommendations ?? [],
          limitations: diagnostic.limitations ?? [],
          metadata: diagnostic.metadata,
        },
      },
      raw_result: {
        ...record.engine_payload.raw_result,
        diagnostics: {
          ...((record.engine_payload.raw_result.diagnostics as Record<string, unknown> | undefined) ?? {}),
          prop_evaluation_readiness: diagnostic,
        },
      },
    },
    access: { ...record.access, can_view_prop_evaluation: diagnostic.status !== "unavailable" && diagnostic.status !== "skipped" },
    diagnostic_statuses: {
      ...record.diagnostic_statuses,
      prop_evaluation_readiness: {
        status: diagnostic.status ?? "limited",
        available: diagnostic.status === "available",
        limited: diagnostic.status === "limited",
        unavailable: diagnostic.status === "unavailable",
        skipped: diagnostic.status === "skipped",
      },
    },
  };
}

export async function recomputePropEvaluationForAnalysis(input: {
  analysisId: string;
  accountId: string;
  userId: string;
  rules?: PropEvaluationRulesV1 | Record<string, unknown> | null;
}) {
  const repositories = getCoreRepositories();
  const analysis = await repositories.analyses.findById(input.analysisId);
  if (!analysis || analysis.account_id !== input.accountId) throw new Error("analysis_not_found");
  if (analysis.status !== "completed" || !analysis.result) throw new Error("analysis_not_completed");
  const artifact = await repositories.artifacts.findById(analysis.artifact_id);
  if (!artifact || artifact.account_id !== input.accountId) throw new Error("artifact_not_found");

  const rules = normalizePropEvaluationRules(mergeRuntimeRules({
    ...(analysis.runtime_config?.prop_evaluation_rules ?? artifact.parsed_artifact.prop_evaluation_rules ?? {}),
    ...(input.rules ?? {}),
    source: input.rules ? "post_run_edit" : (analysis.runtime_config?.prop_evaluation_rules?.source ?? artifact.parsed_artifact.prop_evaluation_rules?.source ?? "fallback"),
  }, analysis.runtime_config));
  const diagnostic = computePropEvaluationReadiness(artifact.parsed_artifact, rules, analysis.runtime_config);
  const persisted = await persistSnapshotAndResult({ analysis, rules, diagnostic, userId: input.userId });
  const nextRecord = mergePropDiagnostic(analysis.result, diagnostic);
  await repositories.analyses.update(analysis.analysis_id, (current) => ({
    ...current,
    updated_at: new Date().toISOString(),
    result: nextRecord,
    runtime_config: {
      ...(current.runtime_config ?? {}),
      prop_evaluation_rules: rules,
    },
  }));

  recordEvidenceEvent({
    analysis_id: analysis.analysis_id,
    account_id: analysis.account_id,
    artifact_id: analysis.artifact_id,
    event_type: input.rules ? "prop_readiness_changed_after_rule_edit" : "prop_readiness_recomputed",
    severity: diagnostic.verdict === "breach_risk" ? "warning" : "info",
    title: input.rules ? "Prop evaluation rules updated" : "Prop evaluation recomputed",
    summary: `Prop evaluation verdict is ${diagnostic.verdict.replaceAll("_", " ")} using ${rules.label}.`,
    payload: {
      rule_snapshot_id: persisted.rule_snapshot_id,
      result_id: persisted.result.result_id,
      rules_hash: rules.rules_hash,
      verdict: diagnostic.verdict,
    },
    created_by_user_id: input.userId,
  });

  return {
    rule_snapshot_id: persisted.rule_snapshot_id,
    result: persisted.result,
    diagnostic,
    rules,
  };
}
