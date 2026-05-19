export const STRATEGY_TRUTH_ROOM_CONTRACT_VERSION = "1.0.0" as const;

export const STRATEGY_TRUTH_ROOM_DIAGNOSTICS = [
  "overview",
  "execution",
  "distribution",
  "monte_carlo",
  "ruin",
  "regimes",
  "stability",
  "assumptions",
  "report",
  "share_room",
  "research_desk",
  "library",
] as const;

export type StrategyTruthRoomDiagnostic = (typeof STRATEGY_TRUTH_ROOM_DIAGNOSTICS)[number];

export const STRATEGY_TRUTH_ROOM_ARTIFACT_FAMILIES = [
  "trade_log_v1",
  "equity_curve_v1",
  "broker_export_v1",
  "backtest_report_v1",
  "strategy_config_v1",
  "ohlcv_context_v1",
  "benchmark_series_v1",
  "parameter_sweep_v1",
  "declared_claims_v1",
  "strategy_truth_room_bundle_v1",
] as const;

export type StrategyTruthRoomArtifactFamily = (typeof STRATEGY_TRUTH_ROOM_ARTIFACT_FAMILIES)[number];

export const STRATEGY_TRUTH_ROOM_VERDICTS = [
  "structurally_credible",
  "promising_but_under_supported",
  "likely_overfit",
  "execution_fantasy",
  "data_insufficient",
  "regime_dependent",
  "untradeable_after_costs",
] as const;

export type StrategyTruthRoomVerdict = (typeof STRATEGY_TRUTH_ROOM_VERDICTS)[number];

export const STRATEGY_TRUTH_ROOM_EVIDENCE_STATES = [
  "supported",
  "limited",
  "unsupported",
  "contradicted",
  "unavailable",
  "plan_locked",
  "pending_review",
] as const;

export type StrategyTruthRoomEvidenceState = (typeof STRATEGY_TRUTH_ROOM_EVIDENCE_STATES)[number];

export const STRATEGY_TRUTH_ROOM_PAGE_SLUGS = [
  "overview",
  "execution",
  "distribution",
  "monte-carlo",
  "ruin",
  "regimes",
  "stability",
  "assumptions",
  "report",
  "share-room",
  "research-desk",
  "library",
] as const;

export type StrategyTruthRoomPageSlug = (typeof STRATEGY_TRUTH_ROOM_PAGE_SLUGS)[number];
