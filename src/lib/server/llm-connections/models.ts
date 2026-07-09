export type LlmProviderId = "openai";
export type LlmProviderConnectionStatus = "active" | "revoked";
export type LlmProviderUsageMode = "byok";

export type LlmProviderConnection = {
  connection_id: string;
  account_id: string;
  created_by_user_id: string;
  provider: LlmProviderId;
  label: string;
  status: LlmProviderConnectionStatus;
  credential_ciphertext?: string;
  credential_key_version?: string;
  api_key_hint: string;
  default_model: string;
  usage_mode: LlmProviderUsageMode;
  last_checked_at?: string;
  last_error?: string;
  last_used_at?: string;
  revoked_at?: string;
  created_at: string;
  updated_at: string;
};

export type LlmProviderAuditEvent = {
  event_id: string;
  connection_id: string;
  account_id: string;
  actor_user_id: string;
  event_type: "created" | "tested" | "used" | "revoked" | "failed";
  metadata: Record<string, unknown>;
  created_at: string;
};
