import type {
  ResearchDeskRequestRecord,
  ResearchDeskRequestStatus,
  ReviewerAddendumRecord,
  WedgeLearningEventRecord,
} from "@/lib/server/research-desk/models";
import { canonicalResearchDeskService, canonicalResearchDeskStatus } from "@/lib/server/research-desk/models";
import { getDb } from "@/lib/server/persistence/database";

function parseJson<T>(value: unknown, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return fallback;
  }
}

function mapRequest(row: Record<string, unknown>): ResearchDeskRequestRecord {
  return {
    request_id: String(row.request_id),
    report_snapshot_id: String(row.report_snapshot_id),
    analysis_id: String(row.analysis_id),
    artifact_id: String(row.artifact_id),
    account_id: String(row.account_id),
    requested_by_user_id: String(row.requested_by_user_id),
    trigger_limitation: String(row.trigger_limitation),
    requested_services: parseJson<string[]>(row.requested_services_json, [])
      .map((service) => canonicalResearchDeskService(service))
      .filter((service): service is ResearchDeskRequestRecord["requested_services"][number] => Boolean(service)),
    validation_packet: parseJson(row.validation_packet_json, undefined as never),
    status: canonicalResearchDeskStatus(String(row.status)) ?? "received",
    user_note: row.user_note ? String(row.user_note) : undefined,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapAddendum(row: Record<string, unknown>): ReviewerAddendumRecord {
  return {
    addendum_id: String(row.addendum_id),
    request_id: String(row.request_id),
    report_snapshot_id: String(row.report_snapshot_id),
    analysis_id: String(row.analysis_id),
    reviewer_user_id: String(row.reviewer_user_id),
    status: row.status as ReviewerAddendumRecord["status"],
    internal_note: row.internal_note ? String(row.internal_note) : undefined,
    public_addendum: row.public_addendum ? String(row.public_addendum) : undefined,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    approved_at: row.approved_at ? String(row.approved_at) : undefined,
  };
}

function mapLearningEvent(row: Record<string, unknown>): WedgeLearningEventRecord {
  return {
    event_id: String(row.event_id),
    request_id: String(row.request_id),
    report_snapshot_id: String(row.report_snapshot_id),
    analysis_id: String(row.analysis_id),
    account_id: String(row.account_id),
    event_type: row.event_type as WedgeLearningEventRecord["event_type"],
    learning_key: String(row.learning_key),
    evidence_count: Number(row.evidence_count),
    promotion_candidate: Number(row.promotion_candidate) === 1,
    promoted_at: row.promoted_at ? String(row.promoted_at) : undefined,
    metadata: parseJson(row.metadata_json, {}),
    created_at: String(row.created_at),
  };
}

export const researchDeskRepository = {
  saveRequest(record: ResearchDeskRequestRecord) {
    getDb()
      .prepare(
        `INSERT INTO research_desk_requests (
          request_id, report_snapshot_id, analysis_id, artifact_id, account_id, requested_by_user_id,
          trigger_limitation, requested_services_json, validation_packet_json, status, user_note, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.request_id,
        record.report_snapshot_id,
        record.analysis_id,
        record.artifact_id,
        record.account_id,
        record.requested_by_user_id,
        record.trigger_limitation,
        JSON.stringify(record.requested_services),
        JSON.stringify(record.validation_packet),
        record.status,
        record.user_note ?? null,
        record.created_at,
        record.updated_at,
      );
    return record;
  },

  findRequestById(requestId: string) {
    const row = getDb().prepare("SELECT * FROM research_desk_requests WHERE request_id = ?").get(requestId) as Record<string, unknown> | undefined;
    return row ? mapRequest(row) : undefined;
  },

  listRequests(status?: ResearchDeskRequestStatus) {
    const rows = status
      ? getDb().prepare("SELECT * FROM research_desk_requests WHERE status = ? ORDER BY created_at DESC").all(status)
      : getDb().prepare("SELECT * FROM research_desk_requests ORDER BY created_at DESC").all();
    return (rows as Record<string, unknown>[]).map(mapRequest);
  },

  listRequestsByAnalysis(analysisId: string) {
    const rows = getDb()
      .prepare("SELECT * FROM research_desk_requests WHERE analysis_id = ? ORDER BY created_at DESC")
      .all(analysisId) as Record<string, unknown>[];
    return rows.map(mapRequest);
  },

  updateRequestStatus(requestId: string, status: ResearchDeskRequestStatus, updatedAt: string) {
    getDb().prepare("UPDATE research_desk_requests SET status = ?, updated_at = ? WHERE request_id = ?").run(status, updatedAt, requestId);
    return this.findRequestById(requestId);
  },

  upsertAddendum(record: ReviewerAddendumRecord) {
    getDb()
      .prepare(
        `INSERT INTO report_reviewer_addenda (
          addendum_id, request_id, report_snapshot_id, analysis_id, reviewer_user_id, status,
          internal_note, public_addendum, created_at, updated_at, approved_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(request_id) DO UPDATE SET
          reviewer_user_id = excluded.reviewer_user_id,
          status = excluded.status,
          internal_note = excluded.internal_note,
          public_addendum = excluded.public_addendum,
          updated_at = excluded.updated_at,
          approved_at = excluded.approved_at`,
      )
      .run(
        record.addendum_id,
        record.request_id,
        record.report_snapshot_id,
        record.analysis_id,
        record.reviewer_user_id,
        record.status,
        record.internal_note ?? null,
        record.public_addendum ?? null,
        record.created_at,
        record.updated_at,
        record.approved_at ?? null,
      );
    return this.findAddendumByRequest(record.request_id);
  },

  findAddendumByRequest(requestId: string) {
    const row = getDb().prepare("SELECT * FROM report_reviewer_addenda WHERE request_id = ?").get(requestId) as Record<string, unknown> | undefined;
    return row ? mapAddendum(row) : undefined;
  },

  listApprovedAddendaBySnapshot(snapshotId: string) {
    const rows = getDb()
      .prepare("SELECT * FROM report_reviewer_addenda WHERE report_snapshot_id = ? AND status = 'approved' ORDER BY approved_at DESC, updated_at DESC")
      .all(snapshotId) as Record<string, unknown>[];
    return rows.map(mapAddendum);
  },

  saveLearningEvent(record: WedgeLearningEventRecord) {
    getDb()
      .prepare(
        `INSERT INTO wedge_learning_events (
          event_id, request_id, report_snapshot_id, analysis_id, account_id, event_type, learning_key,
          evidence_count, promotion_candidate, promoted_at, metadata_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.event_id,
        record.request_id,
        record.report_snapshot_id,
        record.analysis_id,
        record.account_id,
        record.event_type,
        record.learning_key,
        record.evidence_count,
        record.promotion_candidate ? 1 : 0,
        record.promoted_at ?? null,
        JSON.stringify(record.metadata),
        record.created_at,
      );
    return record;
  },

  countLearningEvidence(learningKey: string) {
    const row = getDb()
      .prepare("SELECT COUNT(*) as total FROM wedge_learning_events WHERE learning_key = ?")
      .get(learningKey) as { total?: number } | undefined;
    return Number(row?.total ?? 0);
  },

  listLearningEvents(learningKey?: string) {
    const rows = learningKey
      ? getDb().prepare("SELECT * FROM wedge_learning_events WHERE learning_key = ? ORDER BY created_at DESC").all(learningKey)
      : getDb().prepare("SELECT * FROM wedge_learning_events ORDER BY created_at DESC").all();
    return (rows as Record<string, unknown>[]).map(mapLearningEvent);
  },
};
