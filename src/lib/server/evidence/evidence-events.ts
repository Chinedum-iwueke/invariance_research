import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/server/persistence/database";
import { getDatabaseProvider } from "@/lib/server/persistence/provider";
import { getPostgresPool } from "@/lib/server/persistence/postgres";

export type EvidenceEventType =
  | "upload_accepted"
  | "artifact_classified"
  | "evidence_ledger_snapshot_created"
  | "analysis_queued"
  | "diagnostics_completed"
  | "diagnostic_unlocked"
  | "diagnostic_evidence_limited"
  | "diagnostic_plan_limited"
  | "high_materiality_assumption"
  | "unsupported_claim_blocks_confidence"
  | "verdict_generated"
  | "snapshot_generated"
  | "snapshot_superseded"
  | "export_requested"
  | "export_completed"
  | "export_failed"
  | "share_created"
  | "share_viewed"
  | "share_expired"
  | "share_revoked"
  | "research_desk_packet_created"
  | "research_desk_status_updated"
  | "research_desk_addendum_approved"
  | "prop_readiness_recomputed"
  | "prop_readiness_changed_after_rule_edit"
  | "prop_fallback_rules_replaced";

export type EvidenceEventSeverity = "info" | "warning" | "critical";

export type EvidenceEventRecord = {
  event_id: string;
  analysis_id: string;
  account_id: string;
  artifact_id?: string;
  report_snapshot_id?: string;
  share_id?: string;
  export_id?: string;
  event_type: EvidenceEventType;
  severity: EvidenceEventSeverity;
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  created_by_user_id?: string;
  created_at: string;
};

export type EvidenceEventInput = Omit<EvidenceEventRecord, "event_id" | "created_at" | "payload"> & {
  event_id?: string;
  created_at?: string;
  payload?: Record<string, unknown>;
};

function mapRow(row: Record<string, unknown>): EvidenceEventRecord {
  return {
    event_id: String(row.event_id),
    analysis_id: String(row.analysis_id),
    account_id: String(row.account_id),
    artifact_id: row.artifact_id ? String(row.artifact_id) : undefined,
    report_snapshot_id: row.report_snapshot_id ? String(row.report_snapshot_id) : undefined,
    share_id: row.share_id ? String(row.share_id) : undefined,
    export_id: row.export_id ? String(row.export_id) : undefined,
    event_type: row.event_type as EvidenceEventType,
    severity: row.severity as EvidenceEventSeverity,
    title: String(row.title),
    summary: String(row.summary),
    payload: JSON.parse(String(row.payload_json || "{}")),
    created_by_user_id: row.created_by_user_id ? String(row.created_by_user_id) : undefined,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

export const evidenceEventRepository = {
  save(input: EvidenceEventRecord): EvidenceEventRecord | Promise<EvidenceEventRecord> {
    if (getDatabaseProvider() === "postgres") {
      return getPostgresPool()
        .query(
          `INSERT INTO evidence_events (event_id, analysis_id, account_id, artifact_id, report_snapshot_id, share_id, export_id, event_type, severity, title, summary, payload_json, created_by_user_id, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [
            input.event_id,
            input.analysis_id,
            input.account_id,
            input.artifact_id ?? null,
            input.report_snapshot_id ?? null,
            input.share_id ?? null,
            input.export_id ?? null,
            input.event_type,
            input.severity,
            input.title,
            input.summary,
            JSON.stringify(input.payload ?? {}),
            input.created_by_user_id ?? null,
            input.created_at,
          ],
        )
        .then(() => input);
    }
    getDb()
      .prepare(
        `INSERT INTO evidence_events (event_id, analysis_id, account_id, artifact_id, report_snapshot_id, share_id, export_id, event_type, severity, title, summary, payload_json, created_by_user_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.event_id,
        input.analysis_id,
        input.account_id,
        input.artifact_id ?? null,
        input.report_snapshot_id ?? null,
        input.share_id ?? null,
        input.export_id ?? null,
        input.event_type,
        input.severity,
        input.title,
        input.summary,
        JSON.stringify(input.payload ?? {}),
        input.created_by_user_id ?? null,
        input.created_at,
      );
    return input;
  },

  listByAnalysis(analysisId: string): EvidenceEventRecord[] | Promise<EvidenceEventRecord[]> {
    if (getDatabaseProvider() === "postgres") {
      return getPostgresPool()
        .query("SELECT * FROM evidence_events WHERE analysis_id = $1 ORDER BY created_at DESC", [analysisId])
        .then((result) => result.rows.map(mapRow));
    }
    const rows = getDb()
      .prepare("SELECT * FROM evidence_events WHERE analysis_id = ? ORDER BY created_at DESC")
      .all(analysisId) as Record<string, unknown>[];
    return rows.map(mapRow);
  },
};

export async function recordEvidenceEvent(input: EvidenceEventInput): Promise<EvidenceEventRecord> {
  return await evidenceEventRepository.save({
    event_id: input.event_id ?? randomUUID(),
    analysis_id: input.analysis_id,
    account_id: input.account_id,
    artifact_id: input.artifact_id,
    report_snapshot_id: input.report_snapshot_id,
    share_id: input.share_id,
    export_id: input.export_id,
    event_type: input.event_type,
    severity: input.severity,
    title: input.title,
    summary: input.summary,
    payload: input.payload ?? {},
    created_by_user_id: input.created_by_user_id,
    created_at: input.created_at ?? new Date().toISOString(),
  });
}
