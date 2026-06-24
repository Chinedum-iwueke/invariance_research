export type ExchangeVenue = "bybit" | "binance";
export type ExchangeEnvironment = "demo" | "live";
export type ExchangeProductType = "spot" | "perpetual";
export type ConnectorStatus = "pending" | "healthy" | "degraded" | "blocked" | "revoked";
export type DeploymentStatus = "draft" | "queued" | "starting" | "active" | "paused" | "frozen" | "stopped" | "failed";
export type DeploymentCommandType = "start" | "pause" | "resume" | "freeze" | "emergency_freeze" | "recovery_drill" | "reconcile" | "submit_order" | "stop";

export type ExchangeConnector = {
  connector_id: string; account_id: string; created_by_user_id: string;
  venue: ExchangeVenue; environment: ExchangeEnvironment; product_type: ExchangeProductType; label: string; status: ConnectorStatus;
  api_key_hint: string; permissions: Record<string, unknown>; doctor: Record<string, unknown>;
  last_checked_at?: string; last_used_at?: string; revoked_at?: string; created_at: string; updated_at: string;
};

export type ExchangeConnectorSecret = ExchangeConnector & { credential_ciphertext: string; credential_key_version: string };

export type StrategyDeployment = {
  deployment_id: string; program_id: string; account_id: string; connector_id: string; qualification_id: string;
  venue: ExchangeVenue; environment: ExchangeEnvironment; product_type: ExchangeProductType; status: DeploymentStatus; symbols: string[];
  strategy_spec_hash: string; risk_policy_hash: string; config_hash: string; risk_policy: Record<string, unknown>;
  live_canary_approved: boolean; created_by_user_id: string; approved_by_user_id?: string; approved_at?: string;
  last_heartbeat_at?: string; last_reconciled_at?: string; frozen_reason?: string; started_at?: string; stopped_at?: string;
  created_at: string; updated_at: string;
};

export type DeploymentCommand = {
  command_id: string; deployment_id: string; program_id: string; account_id: string; command_type: DeploymentCommandType;
  status: "queued" | "processing" | "completed" | "failed"; idempotency_key: string; payload: Record<string, unknown>;
  requested_by_user_id: string; available_at: string; leased_until?: string; attempt_count: number; max_attempts: number;
  error_code?: string; created_at: string; processed_at?: string;
};

export type DeploymentProjection = {
  deployment_id: string; account_id: string; health: Record<string, unknown>; balances: Record<string, number>;
  positions: Array<Record<string, unknown>>; orders: Array<Record<string, unknown>>; fills: Array<Record<string, unknown>>;
  incidents: Array<Record<string, unknown>>; snapshot_hash: string; updated_at: string;
};

export type C3ProgramDetail = {
  connectors: ExchangeConnector[]; deployments: StrategyDeployment[]; commands: DeploymentCommand[];
  events: Array<Record<string, unknown>>; projections: DeploymentProjection[];
};
