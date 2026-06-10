import type { AnalysisBenchmarkConfig } from "@/lib/analyses/analysis-types";
import type { AnalysisRecord, ClaimInventoryEntry, ScoreBand } from "@/lib/contracts";
import type { EvidenceState } from "@/components/dashboard/evidence-status";
import { buildTruthContext } from "@/lib/app/context-truth";

export type AnalystWorkbenchDiagnostic =
  | "overview"
  | "distribution"
  | "monte_carlo"
  | "execution"
  | "ruin"
  | "prop_evaluation_readiness"
  | "regimes"
  | "stability"
  | "assumptions"
  | "report";

export interface AnalystWorkbenchModel {
  diagnostic: AnalystWorkbenchDiagnostic;
  title: string;
  attackQuestion: string;
  attackAnswer: string;
  verdictLabel: string;
  verdictSummary: string;
  evidenceState: EvidenceState;
  evidenceLabel: string;
  artifactDependency: string;
  planState: string;
  reportImpact: string;
  assumptions: string[];
  limitations: string[];
  missingEvidence: string[];
  unsupportedClaims: string[];
  nextEvidence: string[];
}

const DIAGNOSTIC_COPY: Record<AnalystWorkbenchDiagnostic, {
  title: string;
  attackQuestion: string;
  artifactDependency: string;
  reportImpact: string;
  nextEvidence: string[];
}> = {
  overview: {
    title: "Case File",
    attackQuestion: "Is this strategy credible enough to investigate further, or is the headline result hiding unresolved fragility?",
    artifactDependency: "Trade outcomes, date coverage, benchmark context, execution assumptions, and diagnostic availability.",
    reportImpact: "Sets the validation posture, evidence confidence, and the next experiment shown in the report.",
    nextEvidence: ["Benchmark or market-context data", "Explicit execution assumptions", "Parameter sweep and regime context"],
  },
  distribution: {
    title: "Distribution Attack",
    attackQuestion: "How much of the edge comes from rare trades, tail behavior, or a small number of lucky outcomes?",
    artifactDependency: "Trade-level PnL, win/loss distribution, trade duration, excursion fields, and cohort metadata where available.",
    reportImpact: "Constrains claims about repeatability, payoff shape, and whether average performance is representative.",
    nextEvidence: ["Full trade log with realized PnL", "MAE/MFE or excursion fields", "Duration and setup/cohort labels"],
  },
  monte_carlo: {
    title: "Path Stress",
    attackQuestion: "How quickly does the thesis degrade when trade order, drawdown paths, and survival assumptions are perturbed?",
    artifactDependency: "Trade sequence, return distribution, simulation settings, drawdown threshold, and serial-dependence support.",
    reportImpact: "Controls tail-risk language, survivability confidence, and whether path luck is treated as a material caveat.",
    nextEvidence: ["Longer trade history", "Serial-dependence or regime labels", "Explicit ruin threshold and simulation settings"],
  },
  execution: {
    title: "Execution Realism",
    attackQuestion: "Does the edge survive worse fills, fees, slippage, and execution assumptions?",
    artifactDependency: "Trade data plus explicit fee, spread, slippage, fill, venue, and order-type assumptions.",
    reportImpact: "Determines whether the report can call the edge tradable after costs or must label it execution-sensitive.",
    nextEvidence: ["Broker/export files with commissions", "Spread/slippage assumptions", "Venue, order type, and fill metadata"],
  },
  ruin: {
    title: "Capital Survival",
    attackQuestion: "What sizing assumptions make this result survivable, and where does capital failure become plausible?",
    artifactDependency: "Trade sequence, account size, risk per trade, drawdown thresholds, and stress sizing assumptions.",
    reportImpact: "Shapes capital-risk warnings, deployment limits, and non-advisory survivability language.",
    nextEvidence: ["Account size and risk budget", "Hard drawdown limit", "Position sizing rules and capital constraints"],
  },
  prop_evaluation_readiness: {
    title: "Prop Evaluation Readiness",
    attackQuestion: "Would this strategy pass the chosen prop-firm evaluation rules without breaching the account contract?",
    artifactDependency: "Trade sequence, account size, daily PnL, max loss rules, profit target, trading-day rules, and consistency constraints.",
    reportImpact: "Turns capital survival into prop-contract language: target progress, breach risk, and what to improve before attempting evaluation.",
    nextEvidence: ["Exact prop firm rule sheet", "Broker/export equity curve", "Intraday loss timestamps", "Position sizing and scaling rules"],
  },
  regimes: {
    title: "Regime Dependence",
    attackQuestion: "Does the edge survive outside the favorable market state, or is it regime-dependent?",
    artifactDependency: "Trade timestamps aligned to OHLCV, volatility/trend state, benchmark context, or explicit regime labels.",
    reportImpact: "Prevents broad deployment claims when performance is concentrated in narrow market conditions.",
    nextEvidence: ["OHLCV/context data", "Regime labels or indicators", "Benchmark-aligned timestamps"],
  },
  stability: {
    title: "Parameter Fragility",
    attackQuestion: "Is performance stable across nearby parameter choices, or does the result depend on a narrow optimized point?",
    artifactDependency: "Parameter sweep bundle, run-to-parameter mapping, per-run results, and optimization metadata.",
    reportImpact: "Controls overfit language and whether the report can call the strategy structurally robust.",
    nextEvidence: ["Parameter sweep bundle", "Run-to-parameter manifest", "Out-of-sample or walk-forward splits"],
  },
  assumptions: {
    title: "Assumption Ledger",
    attackQuestion: "Which assumptions produced this verdict, and what evidence would rescue or invalidate them?",
    artifactDependency: "Normalized facts, source-linked assumptions, claim inventory, missing evidence, and proof-report exclusions.",
    reportImpact: "Carries report-safe boundaries into export, sharing, and Research Desk handoff.",
    nextEvidence: ["Source artifacts for unsupported claims", "Evidence for critical assumptions", "Narrower claim wording where proof is absent"],
  },
  report: {
    title: "Proof Report",
    attackQuestion: "What can be shared without overstating the evidence, leaking private inputs, or hiding limitations?",
    artifactDependency: "All available diagnostics, proof-report exclusions, export permissions, snapshot state, and share-safe limitations.",
    reportImpact: "Defines the final memo wording, export readiness, and handoff packet for deeper review.",
    nextEvidence: ["Resolve unsupported claims", "Generate a report snapshot", "Request Research Desk review for unresolved blockers"],
  },
};

function unique(items: Array<string | undefined>, limit = 6): string[] {
  const values: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const value = item?.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    values.push(value);
    if (values.length >= limit) break;
  }
  return values;
}

function truthyMetadata(value: unknown): boolean {
  return value === true || value === "true" || value === "available" || value === "present";
}

function propEvaluationRuleSource(record: AnalysisRecord): string {
  const diagnostic = (record.diagnostics as Partial<typeof record.diagnostics>).prop_evaluation_readiness;
  return String(diagnostic?.rule_snapshot?.source ?? "");
}

function recommendationSupportedByCurrentEvidence(record: AnalysisRecord, diagnostic: AnalystWorkbenchDiagnostic, item: string): string | undefined {
  const normalized = item.toLowerCase();
  const distributionMetadata = record.diagnostics.distribution.metadata ?? {};
  const hasTradeLog = record.dataset.trade_count > 0 && record.diagnostics.distribution.status !== "unavailable" && record.diagnostics.distribution.status !== "skipped";
  const hasRealizedPnl = truthyMetadata(distributionMetadata.has_win_loss_profile) || record.diagnostics.distribution.metrics.some((metric) => /expectancy|win rate|median return|profit|pnl/i.test(metric.label) && metric.value !== "Unavailable");
  const hasExcursion = truthyMetadata(distributionMetadata.has_excursion) || record.diagnostics.distribution.figures.some((figure) => /mae|mfe|excursion/i.test(`${figure.title} ${figure.subtitle ?? ""}`));
  const hasDuration = truthyMetadata(distributionMetadata.has_duration) || record.diagnostics.distribution.metrics.some((metric) => /duration/i.test(metric.label) && !/unavailable|n\/a|unknown/i.test(metric.value));
  const hasExecution = record.diagnostic_statuses.execution.status === "available";
  const hasRegimes = record.diagnostic_statuses.regimes.status === "available";
  const hasStability = record.diagnostic_statuses.stability.status === "available";
  const propRuleSource = propEvaluationRuleSource(record);
  const hasExactPropRules = propRuleSource.length > 0 && propRuleSource !== "fallback";

  if (diagnostic === "distribution") {
    if (/full trade log|realized pnl/.test(normalized) && hasTradeLog && hasRealizedPnl) return undefined;
    if (/mae|mfe|excursion/.test(normalized) && hasExcursion) return undefined;
    if (/duration and setup\/cohort labels/.test(normalized) && hasDuration) return "Setup/cohort labels";
    if (/duration/.test(normalized) && hasDuration) return undefined;
  }

  if (/benchmark-compatible|configure a benchmark|benchmark context/i.test(item) && record.engine_payload.diagnostics.overview?.benchmark_comparison?.status === "available") return undefined;
  if (/explicit execution assumptions|spread\/slippage assumptions|fee assumptions|execution assumptions/i.test(item) && hasExecution) return undefined;
  if (/ohlcv|regime labels|regime context|market-context/i.test(item) && hasRegimes) return undefined;
  if (/parameter sweep|parameter metadata|parameter stability|parameter combinations/i.test(item) && hasStability) return undefined;
  if (/exact prop firm rule sheet|exact rules|prop firm rules/i.test(item) && hasExactPropRules) return undefined;
  if (/account size|risk budget/i.test(item) && record.diagnostics.ruin.assumptions?.some((assumption) => /account size|risk per trade|risk budget/i.test(String(assumption.name)))) return undefined;

  return item;
}

function groundRecommendations(record: AnalysisRecord, diagnostic: AnalystWorkbenchDiagnostic, items: Array<string | undefined>, limit = 6): string[] {
  return unique(
    items
      .map((item) => item ? recommendationSupportedByCurrentEvidence(record, diagnostic, item) : undefined),
    limit,
  );
}

function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function evidenceStateForStatus(status: string): EvidenceState {
  if (status === "available" || status === "supported" || status === "robust" || status === "advisable") return "supported";
  if (status === "limited" || status === "partially_supported" || status === "moderate" || status === "conditional") return "limited";
  if (status === "locked" || status === "plan_locked") return "locked";
  if (status === "fragile" || status === "contradicted" || status === "not_advisable") return "contradicted";
  return "unsupported";
}

function statusFromScore(score?: ScoreBand): EvidenceState {
  if (!score) return "limited";
  if (score.band === "excellent" || score.band === "good") return "supported";
  if (score.band === "moderate" || score.band === "elevated" || score.band === "informational") return "limited";
  return "contradicted";
}

function diagnosticStatus(record: AnalysisRecord, diagnostic: AnalystWorkbenchDiagnostic): { label: string; state: EvidenceState; reason?: string } {
  if (diagnostic === "assumptions") {
    const unsupported = (record.claim_inventory ?? []).filter((claim) => ["unsupported", "contradicted"].includes(claim.support_status)).length;
    const critical = (record.assumption_ledger ?? []).filter((item) => item.materiality === "critical" || item.materiality === "high").length;
    return {
      label: unsupported ? `${unsupported} unsupported claims` : critical ? `${critical} material assumptions` : "Ledger available",
      state: unsupported ? "limited" : "supported",
    };
  }
  if (diagnostic === "overview") {
    return {
      label: titleCase(record.summary.headline_verdict.status),
      state: evidenceStateForStatus(record.summary.headline_verdict.status),
    };
  }
  const status = record.diagnostic_statuses[diagnostic]?.status ?? "unavailable";
  return {
    label: titleCase(status),
    state: evidenceStateForStatus(status),
    reason: record.diagnostic_statuses[diagnostic]?.reason,
  };
}

function pageClaims(record: AnalysisRecord, diagnostic: AnalystWorkbenchDiagnostic): ClaimInventoryEntry[] {
  const claims = record.claim_inventory ?? [];
  const relevant = claims.filter((claim) => {
    if (diagnostic === "report" || diagnostic === "assumptions" || diagnostic === "overview") return true;
    const diag = diagnostic === "monte_carlo" ? "monte_carlo" : diagnostic;
    return claim.supporting_diagnostics.includes(diag) || claim.contradicting_diagnostics.includes(diag) || claim.missing_evidence.some((item) => item.toLowerCase().includes(diag.replace("_", " ")));
  });
  return relevant.length ? relevant : claims;
}

function missingEvidenceFor(record: AnalysisRecord, diagnostic: AnalystWorkbenchDiagnostic, reason?: string): string[] {
  const claims = pageClaims(record, diagnostic);
  const copy = DIAGNOSTIC_COPY[diagnostic];
  const status = diagnostic === "assumptions" ? undefined : record.diagnostic_statuses[diagnostic]?.status;
  const propRuleSource = diagnostic === "prop_evaluation_readiness"
    ? propEvaluationRuleSource(record)
    : "";
  const hasExactPropRules = diagnostic === "prop_evaluation_readiness" && propRuleSource.length > 0 && propRuleSource !== "fallback";
  return groundRecommendations(record, diagnostic, [
    hasExactPropRules && /fallback|exact prop/i.test(reason ?? "") ? undefined : reason,
    ...(status && status !== "available" ? [`${copy.title} is ${status}; more evidence is required before broad claims are safe.`] : []),
    ...claims.flatMap((claim) => claim.missing_evidence),
    ...copy.nextEvidence.filter((item) => !(hasExactPropRules && /exact prop firm rule sheet/i.test(item))),
  ]);
}

function attackAnswer(record: AnalysisRecord, diagnostic: AnalystWorkbenchDiagnostic, limitations: string[], missingEvidence: string[]): string {
  if (diagnostic === "overview") return record.summary.headline_verdict.summary;
  if (diagnostic === "report") return record.report.executive_summary;
  if (diagnostic === "assumptions") {
    const unsupported = (record.claim_inventory ?? []).filter((claim) => ["unsupported", "contradicted"].includes(claim.support_status)).length;
    return unsupported
      ? `${unsupported} claim${unsupported === 1 ? "" : "s"} still need stronger evidence or narrower wording before the report should present them as proven.`
      : "No unsupported high-priority claim was emitted, but the ledger still defines the assumptions that keep the verdict bounded.";
  }
  const source = (record.diagnostics as Partial<typeof record.diagnostics>)[diagnostic];
  const summary = source?.interpretation?.summary;
  if (summary) return summary;
  if (limitations.length) return limitations[0];
  if (missingEvidence.length) return `Current evidence is incomplete: ${missingEvidence[0]}`;
  return "The diagnostic is available, but this run did not emit a stronger narrative interpretation.";
}

export function buildAnalystWorkbenchModel(
  record: AnalysisRecord,
  diagnostic: AnalystWorkbenchDiagnostic,
  options?: { benchmark?: AnalysisBenchmarkConfig },
): AnalystWorkbenchModel {
  const copy = DIAGNOSTIC_COPY[diagnostic];
  const status = diagnosticStatus(record, diagnostic);
  const truthContext = diagnostic === "assumptions"
    ? {
        assumptions: unique((record.assumption_ledger ?? []).map((item) => item.statement), 6),
        limitations: unique([
          ...(record.proof_report?.what_this_result_does_not_prove ?? []),
          ...(record.claim_inventory ?? []).flatMap((claim) => claim.missing_evidence),
        ], 6),
        recommendations: unique([
          ...(record.assumption_ledger ?? []).map((item) => item.rescue_evidence),
          ...copy.nextEvidence,
        ], 6),
      }
    : buildTruthContext(record, diagnostic, options);
  const missingEvidence = missingEvidenceFor(record, diagnostic, status.reason);
  const claims = pageClaims(record, diagnostic);
  const unsupportedClaims = unique(
    claims
      .filter((claim) => ["unsupported", "contradicted", "outside_scope"].includes(claim.support_status))
      .map((claim) => `${claim.claim} (${titleCase(claim.support_status)})`),
    4,
  );

  const evidenceFacts = record.evidence_facts?.length ?? 0;
  const evidenceLabel = diagnostic === "assumptions"
    ? `${evidenceFacts} accepted facts`
    : status.label;
  const verdictLabel = diagnostic === "overview"
    ? titleCase(record.summary.headline_verdict.status)
    : status.label;
  const planState = diagnostic === "report"
    ? (record.access.can_export_report ? "Export enabled" : "Export locked by plan")
    : diagnostic === "regimes"
      ? (record.access.can_view_regimes ? "Workspace enabled" : "Plan or artifact gated")
      : diagnostic === "stability"
        ? (record.access.can_view_stability ? "Workspace enabled" : "Plan or artifact gated")
        : diagnostic === "ruin"
          ? (record.access.can_view_ruin ? "Workspace enabled" : "Plan or artifact gated")
          : diagnostic === "prop_evaluation_readiness"
            ? (record.access.can_view_prop_evaluation ? "Workspace enabled" : "Plan or artifact gated")
          : "Available in workbench";

  return {
    diagnostic,
    title: copy.title,
    attackQuestion: copy.attackQuestion,
    attackAnswer: attackAnswer(record, diagnostic, truthContext.limitations, missingEvidence),
    verdictLabel,
    verdictSummary: record.summary.short_summary || record.summary.headline_verdict.summary,
    evidenceState: diagnostic === "overview" ? statusFromScore(record.summary.robustness_score) : status.state,
    evidenceLabel,
    artifactDependency: copy.artifactDependency,
    planState,
    reportImpact: copy.reportImpact,
    assumptions: truthContext.assumptions,
    limitations: truthContext.limitations,
    missingEvidence,
    unsupportedClaims,
    nextEvidence: groundRecommendations(record, diagnostic, truthContext.recommendations.length ? truthContext.recommendations : copy.nextEvidence),
  };
}
