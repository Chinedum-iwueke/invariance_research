export const RESEARCH_GENERATION_POLICY_VERSION = "hypothesis_strategy_truth_policy_2026_06_23";

/** Normative generation policy distilled from the engine's prompt and truth-certification documents. */
export const RESEARCH_GENERATION_POLICY = `
Generated research objects are proposals until the user confirms the Hypothesis Card.
Never equate valid JSON or YAML with an executable strategy.
Every test must define a falsifiable claim, observable features, causal timing, entry, exit state machine,
sizing, engine-owned risk, bounded parameter grid, required data, rich logging, evaluation, and explicit scrap criteria.
The engine is authoritative for execution, fills, costs, risk, accounting, and canonical R.
All timestamps are UTC. Decisions use closed bars only. Higher-timeframe values must be complete.
Auxiliary joins are backward-only. Missing bars produce no decision. Interpolation and future values are forbidden.
Funding, open interest, mark, index, and liquidation features must declare availability and fallback behavior.
Do not silently substitute a proxy. Label each field stated, extracted, inferred, recommended, confirmed, unresolved, or unsupported.
Only confirmed blocking semantics may compile. Registry presence, portable-graph support, dataset availability,
strategy admission, deterministic evidence, and Backtest Truth Certification are separate gates.
Unregistered behavior becomes an isolated implementation task with tests and human approval; it is never queued directly.
Results may enter product surfaces or research memory only after experiment truth certification passes.
`;

export const EXACT_EXECUTION_SEMANTICS = {
  strict_utc: true,
  missing_bars: "no_decision",
  interpolation: "forbidden",
  htf_completeness: "closed_only",
  aux_join_direction: "backward",
  execution_authority: "engine",
  risk_authority: "engine",
  accounting: "engine_canonical_R",
} as const;

export const ENGINE_TRUTH_CONTRACT = {
  version: "1.0",
  profile: "production",
  no_lookahead: true,
  ...EXACT_EXECUTION_SEMANTICS,
  truth_gate_required: true,
  parity_required_for_fast_path: true,
  research_memory_requires_certification: true,
} as const;
