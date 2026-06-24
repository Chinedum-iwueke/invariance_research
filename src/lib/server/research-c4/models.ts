export type ResearchStage = "backtest" | "demo" | "live_canary" | "live";
export type DecisionStateSnapshot = {
  schema_version: "decision_state_snapshot_v1"; state_snapshot_id: string; account_id: string; program_id: string;
  stage: ResearchStage; strategy_spec_hash: string; run_id?: string; deployment_id?: string; symbol: string;
  decision_at: string; captured_at: string; features: Record<string, number>; feature_timestamps: Record<string, string>;
  missing_features: string[]; provenance: Record<string, unknown>; future_enriched: false; snapshot_hash: string; created_at: string;
};
export type TradeEpisode = {
  schema_version: "trade_episode_v1"; episode_id: string; account_id: string; program_id: string; stage: ResearchStage;
  run_id?: string; deployment_id?: string; strategy_spec_hash: string; venue?: string; environment?: string;
  product_type: "spot" | "perpetual"; symbol: string; side: "buy" | "sell"; opened_at: string; closed_at?: string;
  quantity: number; entry_price?: number; exit_price?: number; gross_pnl?: number; fees: number; net_pnl?: number;
  status: "open" | "closed" | "cancelled"; decision_state_snapshot_id?: string; source_event_ids: string[];
  source_fill_ids: string[]; data_quality: Record<string, unknown>; created_at: string; updated_at: string;
};
export type MemoryAssessment = {
  schema_version: "memory_assessment_v1"; assessment_id: string; account_id: string; program_id: string;
  strategy_spec_hash: string; current_state_snapshot_id: string; assessment: "supportive"|"neutral"|"caution"|"block"|"insufficient_evidence";
  reason_codes: string[]; support_count: number; strategy_support_count: number; cross_strategy_support_count: number;
  state_similarity_score?: number; drift_ratio?: number; expected_net_pnl?: number; downside_p10_net_pnl?: number;
  empirical_positive_rate?: number; uncertainty_interval: number[]; calibration: Record<string, unknown>;
  source_episode_ids: string[]; missing_state_features: string[]; advisory_only: true; outcome_episode_id?: string;
  actual_positive?: boolean; created_at: string; calibrated_at?: string;
};
export type CanonicalMemoryEntry = { canonical_memory_entry_id:string; account_id:string; program_id:string; entry_type:string; source_type:string; source_id:string; status:string; payload:Record<string,unknown>; lineage:Record<string,unknown>; content_hash:string; confirmed_by_user_id?:string; confirmed_at?:string; created_at:string };
export type C4ProgramDetail = { snapshots:DecisionStateSnapshot[]; episodes:TradeEpisode[]; assessments:MemoryAssessment[]; canonical_entries:CanonicalMemoryEntry[]; calibration:{resolved:number;brier_score?:number;status:string} };
