import type { MemoryAssessment } from "@/lib/server/research-c4/models";

export type LiveSafetyPolicy = {
  allowed_symbols: string[];
  max_order_quantity: number;
  max_order_notional_usd: number;
  max_gross_notional_usd: number;
  max_open_orders: number;
  max_open_positions: number;
  max_daily_loss_usd: number;
  max_session_loss_usd: number;
  close_positions_on_emergency_freeze: boolean;
  allow_reduce_only_when_frozen: true;
};

export type PromotionRecord = { promotion_id:string; deployment_id:string; program_id:string; account_id:string; from_stage:string; to_stage:string; status:string; evidence:Record<string,unknown>; checks:Record<string,unknown>; unresolved:string[]; evidence_hash:string; approved_by_user_id?:string; approved_at?:string; created_at:string };
export type SafetyPolicyRecord = { deployment_id:string; account_id:string; policy:LiveSafetyPolicy; policy_hash:string; status:string; approved_by_user_id?:string; approved_at?:string; kill_switch_tested_at?:string; recovery_drill_passed_at?:string; updated_at:string };
export type DeploymentIncident = { incident_id:string; deployment_id:string; program_id:string; account_id:string; incident_type:string; severity:"info"|"warning"|"critical"; status:"open"|"resolved"; summary:string; details:Record<string,unknown>; source_event_id?:string; created_at:string; resolved_at?:string; resolved_by_user_id?:string };
export type PortfolioSnapshot = { portfolio_snapshot_id:string; deployment_id:string; program_id:string; account_id:string; source_event_id:string; equity?:number; available_balance?:number; margin_used?:number; realized_pnl?:number; unrealized_pnl?:number; drawdown_pct?:number; exposure:Record<string,unknown>; risk:Record<string,unknown>; freshness:Record<string,unknown>; snapshot_hash:string; observed_at:string; ingested_at:string };
export type MemoryPolicyRecord = { memory_policy_id:string; deployment_id:string; program_id:string; account_id:string; mode:"shadow"|"enforced"; status:"draft"|"approved"|"disabled"; thresholds:{minimum_support:number;maximum_drift_ratio:number;block_assessments:string[];block_on_insufficient_evidence:boolean}; policy_hash:string; approved_by_user_id?:string; approved_at?:string; created_at:string; updated_at:string };
export type MemoryPolicyEvaluation = { memory_policy_evaluation_id:string; memory_policy_id:string; deployment_id:string; program_id:string; account_id:string; assessment_id?:string; order_intent_id:string; mode:string; would_block:boolean; applied_block:boolean; reason_codes:string[]; requested_quantity:number; effective_quantity:number; source_episode_ids:string[]; outcome?:string; false_block?:boolean; missed_risk?:boolean; evaluated_at:string; resolved_at?:string };
export type StreamSession = { stream_session_id:string; connector_id:string; account_id:string; venue:string; environment:string; product_type:string; status:string; private_stream_ready:boolean; last_event_at?:string; last_reconciled_at?:string; reconnect_count:number; details:Record<string,unknown>; started_at:string; stopped_at?:string };
export type ConnectorCertification = { connector_certification_id:string; venue:string; environment:string; product_type:string; adapter_version:string; status:string; checks:Record<string,unknown>; fault_tests:Record<string,unknown>; certification_hash:string; certified_at:string };
export type ExecutionSafetyDetail = { promotions:PromotionRecord[]; safety_policies:SafetyPolicyRecord[]; incidents:DeploymentIncident[]; alert_deliveries:Array<{alert_delivery_id:string;incident_id:string;channel:string;destination_hint:string;status:string;attempt_count:number;error_code?:string;created_at:string;sent_at?:string}>; recovery_drills:Array<Record<string,unknown>>; portfolio_snapshots:PortfolioSnapshot[]; audit_actions:Array<{audit_action_id:string;deployment_id:string;action_type:string;actor_user_id:string;payload:Record<string,unknown>;occurred_at:string}>; memory_policies:MemoryPolicyRecord[]; memory_evaluations:MemoryPolicyEvaluation[]; stream_sessions:StreamSession[]; certifications:ConnectorCertification[]; latest_assessments:MemoryAssessment[] };
