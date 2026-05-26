import type {
  ResearchDeskRequestRecord,
  ResearchDeskRequestStatus,
  ReviewerAddendumRecord,
  WedgeLearningEventRecord,
} from "@/lib/server/research-desk/models";
import { canonicalResearchDeskService, canonicalResearchDeskStatus } from "@/lib/server/research-desk/models";
import { getDb } from "@/lib/server/persistence/database";
import { getDatabaseProvider } from "@/lib/server/persistence/provider";
import { getPostgresPool } from "@/lib/server/persistence/postgres";

function iso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

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
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
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
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
    approved_at: row.approved_at ? iso(row.approved_at) : undefined,
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
    created_at: iso(row.created_at),
  };
}

export const researchDeskRepository = {
  saveRequest(record: ResearchDeskRequestRecord): ResearchDeskRequestRecord | Promise<ResearchDeskRequestRecord> {
    if (getDatabaseProvider() === "postgres") {
      return getPostgresPool()
        .query(
          `INSERT INTO research_desk_requests (
            request_id, report_snapshot_id, analysis_id, artifact_id, account_id, requested_by_user_id,
            trigger_limitation, requested_services_json, validation_packet_json, status, user_note, created_at, updated_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [
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
          ],
        )
        .then(() => record);
    }
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

  findRequestById(requestId: string): ResearchDeskRequestRecord | undefined | Promise<ResearchDeskRequestRecord | undefined> {
    if (getDatabaseProvider() === "postgres") {
      return getPostgresPool().query("SELECT * FROM research_desk_requests WHERE request_id = $1", [requestId]).then((result) => result.rows[0] ? mapRequest(result.rows[0]) : undefined);
    }
    const row = getDb().prepare("SELECT * FROM research_desk_requests WHERE request_id = ?").get(requestId) as Record<string, unknown> | undefined;
    return row ? mapRequest(row) : undefined;
  },

  listRequests(status?: ResearchDeskRequestStatus): ResearchDeskRequestRecord[] | Promise<ResearchDeskRequestRecord[]> {
    if (getDatabaseProvider() === "postgres") {
      const sql = status ? "SELECT * FROM research_desk_requests WHERE status = $1 ORDER BY created_at DESC" : "SELECT * FROM research_desk_requests ORDER BY created_at DESC";
      return getPostgresPool().query(sql, status ? [status] : []).then((result) => result.rows.map(mapRequest));
    }
    const rows = status
      ? getDb().prepare("SELECT * FROM research_desk_requests WHERE status = ? ORDER BY created_at DESC").all(status)
      : getDb().prepare("SELECT * FROM research_desk_requests ORDER BY created_at DESC").all();
    return (rows as Record<string, unknown>[]).map(mapRequest);
  },

  listRequestsByAnalysis(analysisId: string): ResearchDeskRequestRecord[] | Promise<ResearchDeskRequestRecord[]> {
    if (getDatabaseProvider() === "postgres") {
      return getPostgresPool().query("SELECT * FROM research_desk_requests WHERE analysis_id = $1 ORDER BY created_at DESC", [analysisId]).then((result) => result.rows.map(mapRequest));
    }
    const rows = getDb()
      .prepare("SELECT * FROM research_desk_requests WHERE analysis_id = ? ORDER BY created_at DESC")
      .all(analysisId) as Record<string, unknown>[];
    return rows.map(mapRequest);
  },

  async updateRequestStatus(requestId: string, status: ResearchDeskRequestStatus, updatedAt: string): Promise<ResearchDeskRequestRecord | undefined> {
    if (getDatabaseProvider() === "postgres") {
      await getPostgresPool().query("UPDATE research_desk_requests SET status = $1, updated_at = $2 WHERE request_id = $3", [status, updatedAt, requestId]);
      return this.findRequestById(requestId);
    }
    getDb().prepare("UPDATE research_desk_requests SET status = ?, updated_at = ? WHERE request_id = ?").run(status, updatedAt, requestId);
    return Promise.resolve(this.findRequestById(requestId));
  },

  async upsertAddendum(record: ReviewerAddendumRecord): Promise<ReviewerAddendumRecord | undefined> {
    if (getDatabaseProvider() === "postgres") {
      await getPostgresPool().query(
        `INSERT INTO report_reviewer_addenda (
          addendum_id, request_id, report_snapshot_id, analysis_id, reviewer_user_id, status,
          internal_note, public_addendum, created_at, updated_at, approved_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT(request_id) DO UPDATE SET
          reviewer_user_id = EXCLUDED.reviewer_user_id,
          status = EXCLUDED.status,
          internal_note = EXCLUDED.internal_note,
          public_addendum = EXCLUDED.public_addendum,
          updated_at = EXCLUDED.updated_at,
          approved_at = EXCLUDED.approved_at`,
        [
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
        ],
      );
      return this.findAddendumByRequest(record.request_id);
    }
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
    return Promise.resolve(this.findAddendumByRequest(record.request_id));
  },

  findAddendumByRequest(requestId: string): ReviewerAddendumRecord | undefined | Promise<ReviewerAddendumRecord | undefined> {
    if (getDatabaseProvider() === "postgres") {
      return getPostgresPool().query("SELECT * FROM report_reviewer_addenda WHERE request_id = $1", [requestId]).then((result) => result.rows[0] ? mapAddendum(result.rows[0]) : undefined);
    }
    const row = getDb().prepare("SELECT * FROM report_reviewer_addenda WHERE request_id = ?").get(requestId) as Record<string, unknown> | undefined;
    return row ? mapAddendum(row) : undefined;
  },

  listApprovedAddendaBySnapshot(snapshotId: string): ReviewerAddendumRecord[] | Promise<ReviewerAddendumRecord[]> {
    if (getDatabaseProvider() === "postgres") {
      return getPostgresPool()
        .query("SELECT * FROM report_reviewer_addenda WHERE report_snapshot_id = $1 AND status = 'approved' ORDER BY approved_at DESC, updated_at DESC", [snapshotId])
        .then((result) => result.rows.map(mapAddendum));
    }
    const rows = getDb()
      .prepare("SELECT * FROM report_reviewer_addenda WHERE report_snapshot_id = ? AND status = 'approved' ORDER BY approved_at DESC, updated_at DESC")
      .all(snapshotId) as Record<string, unknown>[];
    return rows.map(mapAddendum);
  },

  saveLearningEvent(record: WedgeLearningEventRecord): WedgeLearningEventRecord | Promise<WedgeLearningEventRecord> {
    if (getDatabaseProvider() === "postgres") {
      return getPostgresPool()
        .query(
          `INSERT INTO wedge_learning_events (
            event_id, request_id, report_snapshot_id, analysis_id, account_id, event_type, learning_key,
            evidence_count, promotion_candidate, promoted_at, metadata_json, created_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [
            record.event_id,
            record.request_id,
            record.report_snapshot_id,
            record.analysis_id,
            record.account_id,
            record.event_type,
            record.learning_key,
            record.evidence_count,
            record.promotion_candidate,
            record.promoted_at ?? null,
            JSON.stringify(record.metadata),
            record.created_at,
          ],
        )
        .then(() => record);
    }
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

  countLearningEvidence(learningKey: string): number | Promise<number> {
    if (getDatabaseProvider() === "postgres") {
      return getPostgresPool()
        .query<{ total: string }>("SELECT COUNT(*)::text as total FROM wedge_learning_events WHERE learning_key = $1", [learningKey])
        .then((result) => Number(result.rows[0]?.total ?? 0));
    }
    const row = getDb()
      .prepare("SELECT COUNT(*) as total FROM wedge_learning_events WHERE learning_key = ?")
      .get(learningKey) as { total?: number } | undefined;
    return Number(row?.total ?? 0);
  },

  listLearningEvents(learningKey?: string): WedgeLearningEventRecord[] | Promise<WedgeLearningEventRecord[]> {
    if (getDatabaseProvider() === "postgres") {
      const sql = learningKey ? "SELECT * FROM wedge_learning_events WHERE learning_key = $1 ORDER BY created_at DESC" : "SELECT * FROM wedge_learning_events ORDER BY created_at DESC";
      return getPostgresPool().query(sql, learningKey ? [learningKey] : []).then((result) => result.rows.map(mapLearningEvent));
    }
    const rows = learningKey
      ? getDb().prepare("SELECT * FROM wedge_learning_events WHERE learning_key = ? ORDER BY created_at DESC").all(learningKey)
      : getDb().prepare("SELECT * FROM wedge_learning_events ORDER BY created_at DESC").all();
    return (rows as Record<string, unknown>[]).map(mapLearningEvent);
  },
};
