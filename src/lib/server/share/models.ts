import type { EvidenceLedgerEntry } from "@/lib/server/evidence/evidence-ledger-service";
import type { ReportSnapshotRecord } from "@/lib/server/exports/models";

export type ShareTokenStatus = "active" | "revoked";

export type ShareTokenRecord = {
  share_id: string;
  token_hash: string;
  report_snapshot_id: string;
  analysis_id: string;
  account_id: string;
  created_by_user_id: string;
  status: ShareTokenStatus;
  expires_at?: string;
  revoked_at?: string;
  created_at: string;
  updated_at: string;
};

export type ShareAccessEvent = {
  event_id: string;
  share_id?: string;
  token_hash_prefix: string;
  report_snapshot_id?: string;
  outcome: "viewed" | "not_found" | "expired" | "revoked" | "superseded";
  ip_hash?: string;
  user_agent_hash?: string;
  created_at: string;
};

export type SharedReportViewModel = {
  share_id: string;
  snapshot_id: string;
  status: "available" | "expired" | "revoked" | "superseded";
  generated_at: string;
  expires_at?: string;
  strategy_name: string;
  dataset: {
    trade_count: number;
    market?: string;
    start_date?: string;
    end_date?: string;
  };
  verdict: ReportSnapshotRecord["payload"]["report_view"]["verdict"];
  confidence: ReportSnapshotRecord["payload"]["report_view"]["confidence"];
  decision_metrics: ReportSnapshotRecord["payload"]["decision_metrics"];
  diagnostics_summary: string[];
  methodology: string[];
  limitations: string[];
  recommendations: string[];
  deployment_guidance: ReportSnapshotRecord["payload"]["report_view"]["deploymentGuidance"];
  evidence_ledger: Pick<EvidenceLedgerEntry, "diagnostic" | "final_status" | "display_status" | "artifact_reason" | "engine_reason">[];
  warnings: string[];
};
