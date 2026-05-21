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
  first_trade_index: number;
  last_trade_index: number;
};

function buildDailyRows(trades: CanonicalTradeRecord[]): DailyPnlRow[] {
  const rows = new Map<string, DailyPnlRow>();
  trades.forEach((trade, index) => {
    const day = tradeDay(trade, index);
    const existing = rows.get(day);
    if (existing) {
      existing.pnl += tradePnl(trade);
      existing.last_trade_index = index + 1;
    } else {
      rows.set(day, {
        day,
        pnl: tradePnl(trade),
        first_trade_index: index + 1,
        last_trade_index: index + 1,
      });
    }
  });
  return [...rows.values()];
}

function evaluateDailyPath(rows: DailyPnlRow[], rules: NormalizedRules) {
  const accountSize = rules.account_size;
  const targetProfit = accountSize * rules.profit_target_pct;
  let cumulative = 0;
  let highWater = accountSize;
  let maxDrawdownPct = 0;
  let maxDailyLossPct = 0;
  let firstTotalBreach: PropPathEvent | undefined;
  let firstDailyBreach: PropPathEvent | undefined;
  let firstTargetHit: PropPathEvent | undefined;
  const breachEvents: PropPathEvent[] = [];
  const targetEvents: PropPathEvent[] = [];

  rows.forEach((row) => {
    const dayStartEquity = accountSize + cumulative;
    cumulative += row.pnl;
    const equity = accountSize + cumulative;
    highWater = Math.max(highWater, equity);

    const totalDrawdownBasis = rules.total_drawdown_basis === "static" ? accountSize : highWater;
    const totalDrawdownAmount = Math.max(0, totalDrawdownBasis - equity);
    const totalDrawdownPct = totalDrawdownAmount / accountSize;
    maxDrawdownPct = Math.max(maxDrawdownPct, totalDrawdownPct);
    if (!firstTotalBreach && totalDrawdownPct > rules.max_total_drawdown_pct) {
      firstTotalBreach = {
        rule: "max_total_drawdown",
        day: row.day,
        trade_index: row.last_trade_index,
        observed_pct: pct(totalDrawdownPct),
        allowed_pct: pct(rules.max_total_drawdown_pct),
        cumulative_profit: Number(cumulative.toFixed(2)),
        equity: Number(equity.toFixed(2)),
      };
      breachEvents.push(firstTotalBreach);
    }

    const dailyLossBasis = rules.daily_loss_basis === "closed_balance" ? Math.max(dayStartEquity, 1) : accountSize;
    const dailyLossAmount = Math.max(0, -row.pnl);
    const dailyLossPct = dailyLossAmount / dailyLossBasis;
    maxDailyLossPct = Math.max(maxDailyLossPct, dailyLossPct);
    if (!firstDailyBreach && dailyLossPct > rules.max_daily_loss_pct) {
      firstDailyBreach = {
        rule: "max_daily_loss",
        day: row.day,
        trade_index: row.last_trade_index,
        observed_pct: pct(dailyLossPct),
        allowed_pct: pct(rules.max_daily_loss_pct),
        pnl: Number(row.pnl.toFixed(2)),
        cumulative_profit: Number(cumulative.toFixed(2)),
      };
      breachEvents.push(firstDailyBreach);
    }

    if (!firstTargetHit && cumulative >= targetProfit) {
      firstTargetHit = {
        rule: "profit_target",
        day: row.day,
        trade_index: row.last_trade_index,
        observed_pct: pct(cumulative / accountSize),
        allowed_pct: pct(rules.profit_target_pct),
        cumulative_profit: Number(cumulative.toFixed(2)),
        equity: Number(equity.toFixed(2)),
      };
      targetEvents.push(firstTargetHit);
    }
  });

  const largestDayProfit = Math.max(0, ...rows.map((row) => row.pnl));
  const consistencyShare = cumulative > 0 ? largestDayProfit / cumulative : 0;
  const consistencyBreach = rules.consistency_max_day_profit_pct && consistencyShare > rules.consistency_max_day_profit_pct
    ? ({
        rule: "consistency_max_day_profit",
        day: rows[rows.length - 1]?.day,
        trade_index: rows[rows.length - 1]?.last_trade_index,
        observed_pct: pct(consistencyShare),
        allowed_pct: pct(rules.consistency_max_day_profit_pct),
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
    consistencyBreach,
    breachEvents: consistencyBreach ? [...breachEvents, consistencyBreach] : breachEvents,
    targetEvents,
    tradingDays: rows.length,
  };
}

function buildWindowOutcomes(rows: DailyPnlRow[], rules: NormalizedRules) {
  const maxDays = Math.max(1, Math.min(rules.maximum_evaluation_days ?? rows.length, rows.length));
  const windows = rows.map((_, startIndex) => {
    const windowRows = rows.slice(startIndex, startIndex + maxDays);
    const path = evaluateDailyPath(windowRows, rules);
    const firstBreach = earliestBreach(path.firstDailyBreach, path.firstTotalBreach, path.consistencyBreach);
    const targetBeforeBreach = Boolean(path.firstTargetHit && (!firstBreach || ((path.firstTargetHit.trade_index ?? Number.MAX_SAFE_INTEGER) <= (firstBreach.trade_index ?? Number.MAX_SAFE_INTEGER))));
    const breachBeforeTarget = Boolean(firstBreach && (!path.firstTargetHit || ((firstBreach.trade_index ?? Number.MAX_SAFE_INTEGER) < (path.firstTargetHit.trade_index ?? Number.MAX_SAFE_INTEGER))));
    return {
      start_day: windowRows[0]?.day,
      end_day: windowRows[windowRows.length - 1]?.day,
      trading_days: windowRows.length,
      outcome: targetBeforeBreach ? "target_before_breach" : breachBeforeTarget ? "breach_before_target" : "unresolved",
      target_hit_day: path.firstTargetHit?.day,
      breach_day: firstBreach?.day,
      breach_rule: firstBreach?.rule,
      profit: Number(path.cumulative.toFixed(2)),
      profit_pct: pct(path.cumulative / rules.account_size),
      max_daily_loss_pct: pct(path.maxDailyLossPct),
      max_total_drawdown_pct: pct(path.maxDrawdownPct),
    };
  });

  return {
    target_before_breach_count: windows.filter((window) => window.outcome === "target_before_breach").length,
    breach_before_target_count: windows.filter((window) => window.outcome === "breach_before_target").length,
    unresolved_count: windows.filter((window) => window.outcome === "unresolved").length,
    windows: windows.slice(0, 24),
  };
}

function earliestBreach(...events: Array<PropPathEvent | undefined>): PropPathEvent | undefined {
  return events
    .filter((event): event is PropPathEvent => Boolean(event))
    .sort((a, b) => (a.trade_index ?? Number.MAX_SAFE_INTEGER) - (b.trade_index ?? Number.MAX_SAFE_INTEGER))[0];
}

export function computePropEvaluationReadiness(parsedArtifact: ParsedArtifact, rawRules?: PropEvaluationRulesV1 | Record<string, unknown> | null): PropEvaluationDiagnostic {
  const rules = normalizePropEvaluationRules(rawRules ?? parsedArtifact.prop_evaluation_rules);
  const accountSize = rules.account_size;
  const dailyRows = buildDailyRows(parsedArtifact.trades);
  const path = evaluateDailyPath(dailyRows, rules);
  const totalProfit = path.cumulative;
  const targetProfit = accountSize * rules.profit_target_pct;
  const targetReached = totalProfit >= targetProfit;
  const tradingDays = path.tradingDays;
  const firstBreach = earliestBreach(path.firstDailyBreach, path.firstTotalBreach, path.consistencyBreach) ?? null;
  const windowOutcomes = buildWindowOutcomes(dailyRows, rules);
  const dayCountLimited = tradingDays < rules.minimum_trading_days || Boolean(rules.maximum_evaluation_days && tradingDays > rules.maximum_evaluation_days);
  const fallbackLimited = rules.source === "fallback";
  const status = fallbackLimited || dayCountLimited ? "limited" : "available";
  const verdict = firstBreach
    ? "breach_risk"
    : targetReached && !dayCountLimited
      ? "pass_ready"
      : "target_not_reached";
  const ruleStatus: PropEvaluationRuleStatus[] = [
    { rule: "profit_target", status: targetReached ? "pass" : "fail", observed: pct(totalProfit / accountSize), allowed: pct(rules.profit_target_pct) },
    { rule: "max_total_drawdown", status: path.firstTotalBreach ? "fail" : "pass", observed: pct(path.maxDrawdownPct), allowed: pct(rules.max_total_drawdown_pct) },
    { rule: "max_daily_loss", status: path.firstDailyBreach ? "fail" : "pass", observed: pct(path.maxDailyLossPct), allowed: pct(rules.max_daily_loss_pct) },
    { rule: "minimum_trading_days", status: tradingDays >= rules.minimum_trading_days ? "pass" : "limited", observed: tradingDays, allowed: rules.minimum_trading_days },
    { rule: "maximum_evaluation_days", status: rules.maximum_evaluation_days && tradingDays > rules.maximum_evaluation_days ? "fail" : "pass", observed: tradingDays, allowed: rules.maximum_evaluation_days ?? null },
    { rule: "consistency_max_day_profit", status: path.consistencyBreach ? "fail" : "pass", observed: pct(path.consistencyShare), allowed: pct(rules.consistency_max_day_profit_pct ?? 0) },
  ];
  const targetProgress = {
    profit: Number(totalProfit.toFixed(2)),
    target_profit: Number(targetProfit.toFixed(2)),
    progress_pct: pct(targetProfit > 0 ? totalProfit / targetProfit : 0),
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

  return {
    status,
    verdict,
    metrics: [
      score("Target Before Breach", formatPctValue(summaryMetrics.target_before_breach_probability), firstBreach ? "elevated" : "moderate"),
      score("Breach Probability", formatPctValue(summaryMetrics.breach_probability), firstBreach ? "critical" : "moderate"),
      score("Profit Target Progress", `${targetProgress.progress_pct.toFixed(1)}%`, targetReached ? "good" : "moderate"),
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
        `Profit target progress: ${targetProgress.progress_pct.toFixed(1)}%.`,
        `${windowOutcomes.target_before_breach_count} rolling evaluation window(s) reached target before breach; ${windowOutcomes.breach_before_target_count} breached before target.`,
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
    ],
    recommendations: [
      firstBreach ? "Reduce risk per trade or add a daily stop before attempting evaluation." : "Keep the rule sheet saved with the analysis before sharing the verdict.",
      !targetReached ? "Improve profit target progress without increasing daily loss concentration." : "Re-test after any sizing, leverage, or trade-frequency change.",
      "Upload broker equity or intraday balance data to validate daily loss rules with higher precision.",
    ],
    metadata: { summary_metrics: summaryMetrics, target_progress: targetProgress, rule_status: ruleStatus, breach_events: path.breachEvents, target_events: path.targetEvents, evaluation_windows: windowOutcomes.windows },
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

  const rules = normalizePropEvaluationRules({
    ...(analysis.runtime_config?.prop_evaluation_rules ?? artifact.parsed_artifact.prop_evaluation_rules ?? {}),
    ...(input.rules ?? {}),
    source: input.rules ? "post_run_edit" : (analysis.runtime_config?.prop_evaluation_rules?.source ?? artifact.parsed_artifact.prop_evaluation_rules?.source ?? "fallback"),
  });
  const diagnostic = computePropEvaluationReadiness(artifact.parsed_artifact, rules);
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
