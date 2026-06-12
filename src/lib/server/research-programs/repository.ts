import type {
  ProgramArtifact,
  ProgramEvent,
  ProgramMember,
  ProgramNote,
  ProgramClarificationSession,
  ProgramReportSnapshot,
  ExperimentJobEventRecord,
  ExperimentJobRecord,
  ExperimentPlanItemRecord,
  ExperimentPlanRecord,
  HypothesisApprovalRecord,
  HypothesisRecord,
  HypothesisVersionRecord,
  ResearchBriefRecord,
  ProgramSummary,
  ResearchProgram,
  StrategySpecRecord,
} from "@/lib/server/research-programs/models";
import { getDb } from "@/lib/server/persistence/database";
import { getDatabaseProvider } from "@/lib/server/persistence/provider";
import { getPostgresPool } from "@/lib/server/persistence/postgres";

function iso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function json<T>(value: unknown, fallback: T): T {
  if (value === undefined || value === null) return fallback;
  return (typeof value === "string" ? JSON.parse(value) : value) as T;
}

function mapProgram(row: Record<string, unknown>): ResearchProgram {
  return {
    program_id: String(row.program_id),
    account_id: String(row.account_id),
    owner_user_id: String(row.owner_user_id),
    title: String(row.title),
    thesis: String(row.thesis),
    status: row.status as ResearchProgram["status"],
    market: row.market ? String(row.market) : undefined,
    asset_universe: row.asset_universe ? String(row.asset_universe) : undefined,
    timeframe: row.timeframe ? String(row.timeframe) : undefined,
    next_action: String(row.next_action),
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
    archived_at: row.archived_at ? iso(row.archived_at) : undefined,
  };
}

function mapSummary(row: Record<string, unknown>): ProgramSummary {
  return {
    ...mapProgram(row),
    attached_analysis_count: Number(row.attached_analysis_count ?? 0),
    completed_analysis_count: Number(row.completed_analysis_count ?? 0),
    failed_analysis_count: Number(row.failed_analysis_count ?? 0),
    active_hypothesis_count: Number(row.active_hypothesis_count ?? 0),
    promoted_count: Number(row.promoted_count ?? 0),
    last_run_at: row.last_run_at ? iso(row.last_run_at) : undefined,
  };
}

function mapEvent(row: Record<string, unknown>): ProgramEvent {
  return {
    event_id: String(row.event_id),
    program_id: String(row.program_id),
    account_id: String(row.account_id),
    actor_user_id: row.actor_user_id ? String(row.actor_user_id) : undefined,
    event_type: row.event_type as ProgramEvent["event_type"],
    title: String(row.title),
    summary: String(row.summary),
    payload: json(row.payload_json, {}),
    created_at: iso(row.created_at),
  };
}

function mapArtifact(row: Record<string, unknown>): ProgramArtifact {
  return {
    program_artifact_id: String(row.program_artifact_id),
    program_id: String(row.program_id),
    account_id: String(row.account_id),
    artifact_id: row.artifact_id ? String(row.artifact_id) : undefined,
    analysis_id: row.analysis_id ? String(row.analysis_id) : undefined,
    artifact_role: row.artifact_role as ProgramArtifact["artifact_role"],
    attached_by_user_id: String(row.attached_by_user_id),
    created_at: iso(row.created_at),
  };
}

function mapNote(row: Record<string, unknown>): ProgramNote {
  return {
    note_id: String(row.note_id),
    program_id: String(row.program_id),
    account_id: String(row.account_id),
    author_user_id: String(row.author_user_id),
    note_type: row.note_type as ProgramNote["note_type"],
    body: String(row.body),
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
  };
}

function mapReport(row: Record<string, unknown>): ProgramReportSnapshot {
  return {
    program_report_snapshot_id: String(row.program_report_snapshot_id),
    program_id: String(row.program_id),
    account_id: String(row.account_id),
    report_snapshot_id: row.report_snapshot_id ? String(row.report_snapshot_id) : undefined,
    title: String(row.title),
    status: row.status as ProgramReportSnapshot["status"],
    payload: json(row.payload_json, {}),
    created_at: iso(row.created_at),
  };
}

function mapClarificationSession(row: Record<string, unknown>): ProgramClarificationSession {
  return {
    session_id: String(row.session_id),
    program_id: String(row.program_id),
    account_id: String(row.account_id),
    created_by_user_id: String(row.created_by_user_id),
    status: row.status as ProgramClarificationSession["status"],
    raw_intuition: String(row.raw_intuition),
    intake_fields: json(row.intake_fields_json, { market_intuition: String(row.raw_intuition) }),
    assistant_questions: json(row.assistant_questions_json, []),
    missing_assumptions: json(row.missing_assumptions_json, []),
    accepted_answers: row.accepted_answers_json ? json(row.accepted_answers_json, {}) : undefined,
    research_brief: row.research_brief_json ? json<ProgramClarificationSession["research_brief"]>(row.research_brief_json, undefined) : undefined,
    provider: String(row.provider),
    model: row.model ? String(row.model) : undefined,
    error_summary: row.error_summary ? String(row.error_summary) : undefined,
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
    accepted_at: row.accepted_at ? iso(row.accepted_at) : undefined,
  };
}

function mapResearchBrief(row: Record<string, unknown>): ResearchBriefRecord {
  return {
    brief_id: String(row.brief_id),
    program_id: String(row.program_id),
    account_id: String(row.account_id),
    clarification_session_id: row.clarification_session_id ? String(row.clarification_session_id) : undefined,
    version: Number(row.version),
    status: row.status as ResearchBriefRecord["status"],
    brief: json<ResearchBriefRecord["brief"]>(row.brief_json, undefined as never),
    created_by_user_id: String(row.created_by_user_id),
    created_at: iso(row.created_at),
    accepted_at: iso(row.accepted_at),
  };
}

function mapHypothesis(row: Record<string, unknown>): HypothesisRecord {
  return {
    hypothesis_id: String(row.hypothesis_id),
    program_id: String(row.program_id),
    account_id: String(row.account_id),
    title: String(row.title),
    status: row.status as HypothesisRecord["status"],
    active_version_id: row.active_version_id ? String(row.active_version_id) : undefined,
    created_by_user_id: String(row.created_by_user_id),
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
  };
}

function mapHypothesisVersion(row: Record<string, unknown>): HypothesisVersionRecord {
  return {
    hypothesis_version_id: String(row.hypothesis_version_id),
    hypothesis_id: String(row.hypothesis_id),
    program_id: String(row.program_id),
    account_id: String(row.account_id),
    version: Number(row.version),
    status: row.status as HypothesisVersionRecord["status"],
    source_brief_id: row.source_brief_id ? String(row.source_brief_id) : undefined,
    spec: json<HypothesisVersionRecord["spec"]>(row.spec_json, undefined as never),
    validation_errors: json<string[]>(row.validation_errors_json, []),
    created_by_user_id: String(row.created_by_user_id),
    created_at: iso(row.created_at),
    approved_at: row.approved_at ? iso(row.approved_at) : undefined,
    approved_by_user_id: row.approved_by_user_id ? String(row.approved_by_user_id) : undefined,
  };
}

function mapStrategySpec(row: Record<string, unknown>): StrategySpecRecord {
  return {
    strategy_spec_record_id: String(row.strategy_spec_record_id),
    program_id: String(row.program_id),
    account_id: String(row.account_id),
    hypothesis_version_id: String(row.hypothesis_version_id),
    version: Number(row.version),
    status: row.status as StrategySpecRecord["status"],
    spec: json<StrategySpecRecord["spec"]>(row.spec_json, undefined as never),
    validation_errors: json<string[]>(row.validation_errors_json, []),
    created_by_user_id: String(row.created_by_user_id),
    created_at: iso(row.created_at),
    approved_at: row.approved_at ? iso(row.approved_at) : undefined,
    approved_by_user_id: row.approved_by_user_id ? String(row.approved_by_user_id) : undefined,
  };
}

function mapExperimentPlan(row: Record<string, unknown>): ExperimentPlanRecord {
  return {
    experiment_plan_id: String(row.experiment_plan_id),
    program_id: String(row.program_id),
    account_id: String(row.account_id),
    strategy_spec_record_id: String(row.strategy_spec_record_id),
    hypothesis_version_id: String(row.hypothesis_version_id),
    status: row.status as ExperimentPlanRecord["status"],
    plan: json<ExperimentPlanRecord["plan"]>(row.plan_json, undefined as never),
    validation_errors: json<string[]>(row.validation_errors_json, []),
    created_by_user_id: String(row.created_by_user_id),
    created_at: iso(row.created_at),
    approved_at: row.approved_at ? iso(row.approved_at) : undefined,
    approved_by_user_id: row.approved_by_user_id ? String(row.approved_by_user_id) : undefined,
    queued_at: row.queued_at ? iso(row.queued_at) : undefined,
  };
}

function mapExperimentPlanItem(row: Record<string, unknown>): ExperimentPlanItemRecord {
  return {
    experiment_plan_item_id: String(row.experiment_plan_item_id),
    experiment_plan_id: String(row.experiment_plan_id),
    program_id: String(row.program_id),
    account_id: String(row.account_id),
    item_key: String(row.item_key),
    experiment_type: row.experiment_type as ExperimentPlanItemRecord["experiment_type"],
    title: String(row.title),
    status: row.status as ExperimentPlanItemRecord["status"],
    priority: Number(row.priority ?? 0),
    required_datasets: json<string[]>(row.required_datasets_json, []),
    runtime_budget: json<ExperimentPlanItemRecord["runtime_budget"]>(row.runtime_budget_json, { max_minutes: 0, max_variants: 0 }),
    config_patch: json<Record<string, unknown>>(row.config_patch_json, {}),
    falsification_question: String(row.falsification_question),
    created_at: iso(row.created_at),
    queued_at: row.queued_at ? iso(row.queued_at) : undefined,
  };
}

function mapExperimentJob(row: Record<string, unknown>): ExperimentJobRecord {
  return {
    experiment_job_id: String(row.experiment_job_id),
    experiment_plan_item_id: String(row.experiment_plan_item_id),
    experiment_plan_id: String(row.experiment_plan_id),
    program_id: String(row.program_id),
    account_id: String(row.account_id),
    status: row.status as ExperimentJobRecord["status"],
    priority: Number(row.priority ?? 0),
    progress_pct: Number(row.progress_pct ?? 0),
    current_step: String(row.current_step),
    retry_count: Number(row.retry_count ?? 0),
    max_attempts: Number(row.max_attempts ?? 3),
    available_at: iso(row.available_at),
    leased_until: row.leased_until ? iso(row.leased_until) : undefined,
    last_error: row.last_error ? String(row.last_error) : undefined,
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
    started_at: row.started_at ? iso(row.started_at) : undefined,
    finished_at: row.finished_at ? iso(row.finished_at) : undefined,
  };
}

const summarySelect = `
  SELECT
    rp.*,
    COUNT(DISTINCT a.analysis_id) AS attached_analysis_count,
    COUNT(DISTINCT CASE WHEN a.status = 'completed' THEN a.analysis_id END) AS completed_analysis_count,
    COUNT(DISTINCT CASE WHEN a.status = 'failed' THEN a.analysis_id END) AS failed_analysis_count,
    COUNT(DISTINCT CASE WHEN pe.event_type = 'hypothesis_created' THEN pe.event_id END) AS active_hypothesis_count,
    COUNT(DISTINCT CASE WHEN pe.event_type = 'verdict_recorded' AND CAST(pe.payload_json AS TEXT) LIKE '%promoted%' THEN pe.event_id END) AS promoted_count,
    MAX(a.updated_at) AS last_run_at
  FROM research_programs rp
  LEFT JOIN analyses a ON a.program_id = rp.program_id
  LEFT JOIN program_events pe ON pe.program_id = rp.program_id
`;

export const researchProgramRepository = {
  async save(program: ResearchProgram): Promise<ResearchProgram> {
    if (getDatabaseProvider() === "postgres") {
      await getPostgresPool().query(
        `INSERT INTO research_programs (program_id, account_id, owner_user_id, title, thesis, status, market, asset_universe, timeframe, next_action, created_at, updated_at, archived_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          program.program_id,
          program.account_id,
          program.owner_user_id,
          program.title,
          program.thesis,
          program.status,
          program.market ?? null,
          program.asset_universe ?? null,
          program.timeframe ?? null,
          program.next_action,
          program.created_at,
          program.updated_at,
          program.archived_at ?? null,
        ],
      );
      return program;
    }
    getDb()
      .prepare(
        `INSERT INTO research_programs (program_id, account_id, owner_user_id, title, thesis, status, market, asset_universe, timeframe, next_action, created_at, updated_at, archived_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        program.program_id,
        program.account_id,
        program.owner_user_id,
        program.title,
        program.thesis,
        program.status,
        program.market ?? null,
        program.asset_universe ?? null,
        program.timeframe ?? null,
        program.next_action,
        program.created_at,
        program.updated_at,
        program.archived_at ?? null,
      );
    return program;
  },

  async saveMember(member: ProgramMember): Promise<ProgramMember> {
    if (getDatabaseProvider() === "postgres") {
      await getPostgresPool().query(
        `INSERT INTO program_members (program_id, account_id, user_id, role, created_at)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (program_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
        [member.program_id, member.account_id, member.user_id, member.role, member.created_at],
      );
      return member;
    }
    getDb()
      .prepare(
        `INSERT INTO program_members (program_id, account_id, user_id, role, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(program_id, user_id) DO UPDATE SET role = excluded.role`,
      )
      .run(member.program_id, member.account_id, member.user_id, member.role, member.created_at);
    return member;
  },

  async recordEvent(event: ProgramEvent): Promise<ProgramEvent> {
    if (getDatabaseProvider() === "postgres") {
      await getPostgresPool().query(
        `INSERT INTO program_events (event_id, program_id, account_id, actor_user_id, event_type, title, summary, payload_json, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          event.event_id,
          event.program_id,
          event.account_id,
          event.actor_user_id ?? null,
          event.event_type,
          event.title,
          event.summary,
          JSON.stringify(event.payload),
          event.created_at,
        ],
      );
      return event;
    }
    getDb()
      .prepare(
        `INSERT INTO program_events (event_id, program_id, account_id, actor_user_id, event_type, title, summary, payload_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        event.event_id,
        event.program_id,
        event.account_id,
        event.actor_user_id ?? null,
        event.event_type,
        event.title,
        event.summary,
        JSON.stringify(event.payload),
        event.created_at,
      );
    return event;
  },

  async listSummaries(accountId: string): Promise<ProgramSummary[]> {
    if (getDatabaseProvider() === "postgres") {
      const result = await getPostgresPool().query(
        `${summarySelect}
         WHERE rp.account_id = $1
         GROUP BY rp.program_id
         ORDER BY rp.updated_at DESC`,
        [accountId],
      );
      return result.rows.map(mapSummary);
    }
    const rows = getDb()
      .prepare(
        `${summarySelect}
         WHERE rp.account_id = ?
         GROUP BY rp.program_id
         ORDER BY rp.updated_at DESC`,
      )
      .all(accountId) as Record<string, unknown>[];
    return rows.map(mapSummary);
  },

  async findSummaryById(programId: string): Promise<ProgramSummary | undefined> {
    if (getDatabaseProvider() === "postgres") {
      const result = await getPostgresPool().query(
        `${summarySelect}
         WHERE rp.program_id = $1
         GROUP BY rp.program_id
         LIMIT 1`,
        [programId],
      );
      return result.rows[0] ? mapSummary(result.rows[0]) : undefined;
    }
    const row = getDb()
      .prepare(
        `${summarySelect}
         WHERE rp.program_id = ?
         GROUP BY rp.program_id
         LIMIT 1`,
      )
      .get(programId) as Record<string, unknown> | undefined;
    return row ? mapSummary(row) : undefined;
  },

  async listEvents(programId: string): Promise<ProgramEvent[]> {
    if (getDatabaseProvider() === "postgres") {
      const result = await getPostgresPool().query("SELECT * FROM program_events WHERE program_id = $1 ORDER BY created_at DESC", [programId]);
      return result.rows.map(mapEvent);
    }
    const rows = getDb().prepare("SELECT * FROM program_events WHERE program_id = ? ORDER BY created_at DESC").all(programId) as Record<string, unknown>[];
    return rows.map(mapEvent);
  },

  async listArtifacts(programId: string): Promise<ProgramArtifact[]> {
    if (getDatabaseProvider() === "postgres") {
      const result = await getPostgresPool().query("SELECT * FROM program_artifacts WHERE program_id = $1 ORDER BY created_at DESC", [programId]);
      return result.rows.map(mapArtifact);
    }
    const rows = getDb().prepare("SELECT * FROM program_artifacts WHERE program_id = ? ORDER BY created_at DESC").all(programId) as Record<string, unknown>[];
    return rows.map(mapArtifact);
  },

  async listNotes(programId: string): Promise<ProgramNote[]> {
    if (getDatabaseProvider() === "postgres") {
      const result = await getPostgresPool().query("SELECT * FROM program_notes WHERE program_id = $1 ORDER BY created_at DESC", [programId]);
      return result.rows.map(mapNote);
    }
    const rows = getDb().prepare("SELECT * FROM program_notes WHERE program_id = ? ORDER BY created_at DESC").all(programId) as Record<string, unknown>[];
    return rows.map(mapNote);
  },

  async listProgramReports(programId: string): Promise<ProgramReportSnapshot[]> {
    if (getDatabaseProvider() === "postgres") {
      const result = await getPostgresPool().query("SELECT * FROM program_report_snapshots WHERE program_id = $1 ORDER BY created_at DESC", [programId]);
      return result.rows.map(mapReport);
    }
    const rows = getDb().prepare("SELECT * FROM program_report_snapshots WHERE program_id = ? ORDER BY created_at DESC").all(programId) as Record<string, unknown>[];
    return rows.map(mapReport);
  },

  async saveClarificationSession(session: ProgramClarificationSession): Promise<ProgramClarificationSession> {
    if (getDatabaseProvider() === "postgres") {
      await getPostgresPool().query(
        `INSERT INTO program_clarification_sessions (session_id, program_id, account_id, created_by_user_id, status, raw_intuition, intake_fields_json, assistant_questions_json, missing_assumptions_json, accepted_answers_json, research_brief_json, provider, model, error_summary, created_at, updated_at, accepted_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [
          session.session_id,
          session.program_id,
          session.account_id,
          session.created_by_user_id,
          session.status,
          session.raw_intuition,
          JSON.stringify(session.intake_fields),
          JSON.stringify(session.assistant_questions),
          JSON.stringify(session.missing_assumptions),
          session.accepted_answers ? JSON.stringify(session.accepted_answers) : null,
          session.research_brief ? JSON.stringify(session.research_brief) : null,
          session.provider,
          session.model ?? null,
          session.error_summary ?? null,
          session.created_at,
          session.updated_at,
          session.accepted_at ?? null,
        ],
      );
      return session;
    }
    getDb()
      .prepare(
        `INSERT INTO program_clarification_sessions (session_id, program_id, account_id, created_by_user_id, status, raw_intuition, intake_fields_json, assistant_questions_json, missing_assumptions_json, accepted_answers_json, research_brief_json, provider, model, error_summary, created_at, updated_at, accepted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        session.session_id,
        session.program_id,
        session.account_id,
        session.created_by_user_id,
        session.status,
        session.raw_intuition,
        JSON.stringify(session.intake_fields),
        JSON.stringify(session.assistant_questions),
        JSON.stringify(session.missing_assumptions),
        session.accepted_answers ? JSON.stringify(session.accepted_answers) : null,
        session.research_brief ? JSON.stringify(session.research_brief) : null,
        session.provider,
        session.model ?? null,
        session.error_summary ?? null,
        session.created_at,
        session.updated_at,
        session.accepted_at ?? null,
      );
    return session;
  },

  async findClarificationSession(sessionId: string): Promise<ProgramClarificationSession | undefined> {
    if (getDatabaseProvider() === "postgres") {
      const result = await getPostgresPool().query("SELECT * FROM program_clarification_sessions WHERE session_id = $1", [sessionId]);
      return result.rows[0] ? mapClarificationSession(result.rows[0]) : undefined;
    }
    const row = getDb().prepare("SELECT * FROM program_clarification_sessions WHERE session_id = ?").get(sessionId) as Record<string, unknown> | undefined;
    return row ? mapClarificationSession(row) : undefined;
  },

  async listClarificationSessions(programId: string): Promise<ProgramClarificationSession[]> {
    if (getDatabaseProvider() === "postgres") {
      const result = await getPostgresPool().query("SELECT * FROM program_clarification_sessions WHERE program_id = $1 ORDER BY created_at DESC", [programId]);
      return result.rows.map(mapClarificationSession);
    }
    const rows = getDb()
      .prepare("SELECT * FROM program_clarification_sessions WHERE program_id = ? ORDER BY created_at DESC")
      .all(programId) as Record<string, unknown>[];
    return rows.map(mapClarificationSession);
  },

  async acceptClarificationSession(input: {
    session_id: string;
    accepted_answers: Record<string, string>;
    research_brief: ProgramClarificationSession["research_brief"];
    accepted_at: string;
  }): Promise<void> {
    if (getDatabaseProvider() === "postgres") {
      await getPostgresPool().query(
        `UPDATE program_clarification_sessions
         SET status = 'accepted', accepted_answers_json = $1, research_brief_json = $2, updated_at = $3, accepted_at = $3
         WHERE session_id = $4`,
        [JSON.stringify(input.accepted_answers), JSON.stringify(input.research_brief), input.accepted_at, input.session_id],
      );
      return;
    }
    getDb()
      .prepare(
        `UPDATE program_clarification_sessions
         SET status = 'accepted', accepted_answers_json = ?, research_brief_json = ?, updated_at = ?, accepted_at = ?
         WHERE session_id = ?`,
      )
      .run(JSON.stringify(input.accepted_answers), JSON.stringify(input.research_brief), input.accepted_at, input.accepted_at, input.session_id);
  },

  async saveResearchBrief(brief: ResearchBriefRecord): Promise<ResearchBriefRecord> {
    if (getDatabaseProvider() === "postgres") {
      await getPostgresPool().query(
        `INSERT INTO research_briefs (brief_id, program_id, account_id, clarification_session_id, version, status, brief_json, created_by_user_id, created_at, accepted_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          brief.brief_id,
          brief.program_id,
          brief.account_id,
          brief.clarification_session_id ?? null,
          brief.version,
          brief.status,
          JSON.stringify(brief.brief),
          brief.created_by_user_id,
          brief.created_at,
          brief.accepted_at,
        ],
      );
      return brief;
    }
    getDb()
      .prepare(
        `INSERT INTO research_briefs (brief_id, program_id, account_id, clarification_session_id, version, status, brief_json, created_by_user_id, created_at, accepted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        brief.brief_id,
        brief.program_id,
        brief.account_id,
        brief.clarification_session_id ?? null,
        brief.version,
        brief.status,
        JSON.stringify(brief.brief),
        brief.created_by_user_id,
        brief.created_at,
        brief.accepted_at,
      );
    return brief;
  },

  async listResearchBriefs(programId: string): Promise<ResearchBriefRecord[]> {
    if (getDatabaseProvider() === "postgres") {
      const result = await getPostgresPool().query("SELECT * FROM research_briefs WHERE program_id = $1 ORDER BY version DESC", [programId]);
      return result.rows.map(mapResearchBrief);
    }
    const rows = getDb().prepare("SELECT * FROM research_briefs WHERE program_id = ? ORDER BY version DESC").all(programId) as Record<string, unknown>[];
    return rows.map(mapResearchBrief);
  },

  async saveHypothesis(input: {
    hypothesis: HypothesisRecord;
    version: HypothesisVersionRecord;
    approval: HypothesisApprovalRecord;
  }): Promise<HypothesisVersionRecord> {
    if (getDatabaseProvider() === "postgres") {
      await getPostgresPool().query(
        `INSERT INTO hypotheses (hypothesis_id, program_id, account_id, title, status, active_version_id, created_by_user_id, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (hypothesis_id) DO UPDATE SET title = EXCLUDED.title, status = EXCLUDED.status, updated_at = EXCLUDED.updated_at`,
        [
          input.hypothesis.hypothesis_id,
          input.hypothesis.program_id,
          input.hypothesis.account_id,
          input.hypothesis.title,
          input.hypothesis.status,
          input.hypothesis.active_version_id ?? null,
          input.hypothesis.created_by_user_id,
          input.hypothesis.created_at,
          input.hypothesis.updated_at,
        ],
      );
      await getPostgresPool().query(
        `INSERT INTO hypothesis_versions (hypothesis_version_id, hypothesis_id, program_id, account_id, version, status, source_brief_id, spec_json, validation_errors_json, created_by_user_id, created_at, approved_at, approved_by_user_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          input.version.hypothesis_version_id,
          input.version.hypothesis_id,
          input.version.program_id,
          input.version.account_id,
          input.version.version,
          input.version.status,
          input.version.source_brief_id ?? null,
          JSON.stringify(input.version.spec),
          JSON.stringify(input.version.validation_errors),
          input.version.created_by_user_id,
          input.version.created_at,
          input.version.approved_at ?? null,
          input.version.approved_by_user_id ?? null,
        ],
      );
      await getPostgresPool().query(
        `INSERT INTO hypothesis_approvals (approval_id, hypothesis_version_id, hypothesis_id, program_id, account_id, actor_user_id, from_status, to_status, note, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          input.approval.approval_id,
          input.approval.hypothesis_version_id,
          input.approval.hypothesis_id,
          input.approval.program_id,
          input.approval.account_id,
          input.approval.actor_user_id,
          input.approval.from_status ?? null,
          input.approval.to_status,
          input.approval.note ?? null,
          input.approval.created_at,
        ],
      );
      return input.version;
    }
    const db = getDb();
    db.prepare(
      `INSERT INTO hypotheses (hypothesis_id, program_id, account_id, title, status, active_version_id, created_by_user_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(hypothesis_id) DO UPDATE SET title = excluded.title, status = excluded.status, updated_at = excluded.updated_at`,
    ).run(
      input.hypothesis.hypothesis_id,
      input.hypothesis.program_id,
      input.hypothesis.account_id,
      input.hypothesis.title,
      input.hypothesis.status,
      input.hypothesis.active_version_id ?? null,
      input.hypothesis.created_by_user_id,
      input.hypothesis.created_at,
      input.hypothesis.updated_at,
    );
    db.prepare(
      `INSERT INTO hypothesis_versions (hypothesis_version_id, hypothesis_id, program_id, account_id, version, status, source_brief_id, spec_json, validation_errors_json, created_by_user_id, created_at, approved_at, approved_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      input.version.hypothesis_version_id,
      input.version.hypothesis_id,
      input.version.program_id,
      input.version.account_id,
      input.version.version,
      input.version.status,
      input.version.source_brief_id ?? null,
      JSON.stringify(input.version.spec),
      JSON.stringify(input.version.validation_errors),
      input.version.created_by_user_id,
      input.version.created_at,
      input.version.approved_at ?? null,
      input.version.approved_by_user_id ?? null,
    );
    db.prepare(
      `INSERT INTO hypothesis_approvals (approval_id, hypothesis_version_id, hypothesis_id, program_id, account_id, actor_user_id, from_status, to_status, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      input.approval.approval_id,
      input.approval.hypothesis_version_id,
      input.approval.hypothesis_id,
      input.approval.program_id,
      input.approval.account_id,
      input.approval.actor_user_id,
      input.approval.from_status ?? null,
      input.approval.to_status,
      input.approval.note ?? null,
      input.approval.created_at,
    );
    return input.version;
  },

  async listHypotheses(programId: string): Promise<HypothesisRecord[]> {
    if (getDatabaseProvider() === "postgres") {
      const result = await getPostgresPool().query("SELECT * FROM hypotheses WHERE program_id = $1 ORDER BY updated_at DESC", [programId]);
      return result.rows.map(mapHypothesis);
    }
    const rows = getDb().prepare("SELECT * FROM hypotheses WHERE program_id = ? ORDER BY updated_at DESC").all(programId) as Record<string, unknown>[];
    return rows.map(mapHypothesis);
  },

  async listHypothesisVersions(programId: string): Promise<HypothesisVersionRecord[]> {
    if (getDatabaseProvider() === "postgres") {
      const result = await getPostgresPool().query("SELECT * FROM hypothesis_versions WHERE program_id = $1 ORDER BY created_at DESC", [programId]);
      return result.rows.map(mapHypothesisVersion);
    }
    const rows = getDb().prepare("SELECT * FROM hypothesis_versions WHERE program_id = ? ORDER BY created_at DESC").all(programId) as Record<string, unknown>[];
    return rows.map(mapHypothesisVersion);
  },

  async findHypothesisVersion(versionId: string): Promise<HypothesisVersionRecord | undefined> {
    if (getDatabaseProvider() === "postgres") {
      const result = await getPostgresPool().query("SELECT * FROM hypothesis_versions WHERE hypothesis_version_id = $1", [versionId]);
      return result.rows[0] ? mapHypothesisVersion(result.rows[0]) : undefined;
    }
    const row = getDb().prepare("SELECT * FROM hypothesis_versions WHERE hypothesis_version_id = ?").get(versionId) as Record<string, unknown> | undefined;
    return row ? mapHypothesisVersion(row) : undefined;
  },

  async approveHypothesisVersion(input: HypothesisApprovalRecord): Promise<void> {
    if (getDatabaseProvider() === "postgres") {
      await getPostgresPool().query(
        `UPDATE hypothesis_versions
         SET status = $1, approved_at = $2, approved_by_user_id = $3
         WHERE hypothesis_version_id = $4 AND account_id = $5`,
        [input.to_status, input.created_at, input.actor_user_id, input.hypothesis_version_id, input.account_id],
      );
      await getPostgresPool().query(
        `UPDATE hypotheses
         SET status = $1, active_version_id = $2, updated_at = $3
         WHERE hypothesis_id = $4 AND account_id = $5`,
        [input.to_status, input.hypothesis_version_id, input.created_at, input.hypothesis_id, input.account_id],
      );
      await getPostgresPool().query(
        `INSERT INTO hypothesis_approvals (approval_id, hypothesis_version_id, hypothesis_id, program_id, account_id, actor_user_id, from_status, to_status, note, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          input.approval_id,
          input.hypothesis_version_id,
          input.hypothesis_id,
          input.program_id,
          input.account_id,
          input.actor_user_id,
          input.from_status ?? null,
          input.to_status,
          input.note ?? null,
          input.created_at,
        ],
      );
      return;
    }
    const db = getDb();
    db.prepare(
      `UPDATE hypothesis_versions
       SET status = ?, approved_at = ?, approved_by_user_id = ?
       WHERE hypothesis_version_id = ? AND account_id = ?`,
    ).run(input.to_status, input.created_at, input.actor_user_id, input.hypothesis_version_id, input.account_id);
    db.prepare(
      `UPDATE hypotheses
       SET status = ?, active_version_id = ?, updated_at = ?
       WHERE hypothesis_id = ? AND account_id = ?`,
    ).run(input.to_status, input.hypothesis_version_id, input.created_at, input.hypothesis_id, input.account_id);
    db.prepare(
      `INSERT INTO hypothesis_approvals (approval_id, hypothesis_version_id, hypothesis_id, program_id, account_id, actor_user_id, from_status, to_status, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      input.approval_id,
      input.hypothesis_version_id,
      input.hypothesis_id,
      input.program_id,
      input.account_id,
      input.actor_user_id,
      input.from_status ?? null,
      input.to_status,
      input.note ?? null,
      input.created_at,
    );
  },

  async saveStrategySpec(spec: StrategySpecRecord): Promise<StrategySpecRecord> {
    if (getDatabaseProvider() === "postgres") {
      await getPostgresPool().query(
        `INSERT INTO strategy_specs (strategy_spec_record_id, program_id, account_id, hypothesis_version_id, version, status, spec_json, validation_errors_json, created_by_user_id, created_at, approved_at, approved_by_user_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          spec.strategy_spec_record_id,
          spec.program_id,
          spec.account_id,
          spec.hypothesis_version_id,
          spec.version,
          spec.status,
          JSON.stringify(spec.spec),
          JSON.stringify(spec.validation_errors),
          spec.created_by_user_id,
          spec.created_at,
          spec.approved_at ?? null,
          spec.approved_by_user_id ?? null,
        ],
      );
      return spec;
    }
    getDb().prepare(
      `INSERT INTO strategy_specs (strategy_spec_record_id, program_id, account_id, hypothesis_version_id, version, status, spec_json, validation_errors_json, created_by_user_id, created_at, approved_at, approved_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      spec.strategy_spec_record_id,
      spec.program_id,
      spec.account_id,
      spec.hypothesis_version_id,
      spec.version,
      spec.status,
      JSON.stringify(spec.spec),
      JSON.stringify(spec.validation_errors),
      spec.created_by_user_id,
      spec.created_at,
      spec.approved_at ?? null,
      spec.approved_by_user_id ?? null,
    );
    return spec;
  },

  async listStrategySpecs(programId: string): Promise<StrategySpecRecord[]> {
    if (getDatabaseProvider() === "postgres") {
      const result = await getPostgresPool().query("SELECT * FROM strategy_specs WHERE program_id = $1 ORDER BY created_at DESC", [programId]);
      return result.rows.map(mapStrategySpec);
    }
    const rows = getDb().prepare("SELECT * FROM strategy_specs WHERE program_id = ? ORDER BY created_at DESC").all(programId) as Record<string, unknown>[];
    return rows.map(mapStrategySpec);
  },

  async findStrategySpec(recordId: string): Promise<StrategySpecRecord | undefined> {
    if (getDatabaseProvider() === "postgres") {
      const result = await getPostgresPool().query("SELECT * FROM strategy_specs WHERE strategy_spec_record_id = $1", [recordId]);
      return result.rows[0] ? mapStrategySpec(result.rows[0]) : undefined;
    }
    const row = getDb().prepare("SELECT * FROM strategy_specs WHERE strategy_spec_record_id = ?").get(recordId) as Record<string, unknown> | undefined;
    return row ? mapStrategySpec(row) : undefined;
  },

  async approveStrategySpec(input: {
    strategy_spec_record_id: string;
    account_id: string;
    user_id: string;
    approved_at: string;
  }): Promise<void> {
    if (getDatabaseProvider() === "postgres") {
      await getPostgresPool().query(
        `UPDATE strategy_specs
         SET status = 'approved_for_execution', approved_at = $1, approved_by_user_id = $2
         WHERE strategy_spec_record_id = $3 AND account_id = $4`,
        [input.approved_at, input.user_id, input.strategy_spec_record_id, input.account_id],
      );
      return;
    }
    getDb()
      .prepare(
        `UPDATE strategy_specs
         SET status = 'approved_for_execution', approved_at = ?, approved_by_user_id = ?
         WHERE strategy_spec_record_id = ? AND account_id = ?`,
      )
      .run(input.approved_at, input.user_id, input.strategy_spec_record_id, input.account_id);
  },

  async saveExperimentPlan(input: {
    plan: ExperimentPlanRecord;
    items: ExperimentPlanItemRecord[];
  }): Promise<ExperimentPlanRecord> {
    if (getDatabaseProvider() === "postgres") {
      await getPostgresPool().query(
        `INSERT INTO experiment_plans (experiment_plan_id, program_id, account_id, strategy_spec_record_id, hypothesis_version_id, status, plan_json, validation_errors_json, created_by_user_id, created_at, approved_at, approved_by_user_id, queued_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          input.plan.experiment_plan_id,
          input.plan.program_id,
          input.plan.account_id,
          input.plan.strategy_spec_record_id,
          input.plan.hypothesis_version_id,
          input.plan.status,
          JSON.stringify(input.plan.plan),
          JSON.stringify(input.plan.validation_errors),
          input.plan.created_by_user_id,
          input.plan.created_at,
          input.plan.approved_at ?? null,
          input.plan.approved_by_user_id ?? null,
          input.plan.queued_at ?? null,
        ],
      );
      for (const item of input.items) {
        await getPostgresPool().query(
          `INSERT INTO experiment_plan_items (experiment_plan_item_id, experiment_plan_id, program_id, account_id, item_key, experiment_type, title, status, priority, required_datasets_json, runtime_budget_json, config_patch_json, falsification_question, created_at, queued_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
          [
            item.experiment_plan_item_id,
            item.experiment_plan_id,
            item.program_id,
            item.account_id,
            item.item_key,
            item.experiment_type,
            item.title,
            item.status,
            item.priority,
            JSON.stringify(item.required_datasets),
            JSON.stringify(item.runtime_budget),
            JSON.stringify(item.config_patch),
            item.falsification_question,
            item.created_at,
            item.queued_at ?? null,
          ],
        );
      }
      return input.plan;
    }
    const db = getDb();
    db.prepare(
      `INSERT INTO experiment_plans (experiment_plan_id, program_id, account_id, strategy_spec_record_id, hypothesis_version_id, status, plan_json, validation_errors_json, created_by_user_id, created_at, approved_at, approved_by_user_id, queued_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      input.plan.experiment_plan_id,
      input.plan.program_id,
      input.plan.account_id,
      input.plan.strategy_spec_record_id,
      input.plan.hypothesis_version_id,
      input.plan.status,
      JSON.stringify(input.plan.plan),
      JSON.stringify(input.plan.validation_errors),
      input.plan.created_by_user_id,
      input.plan.created_at,
      input.plan.approved_at ?? null,
      input.plan.approved_by_user_id ?? null,
      input.plan.queued_at ?? null,
    );
    const stmt = db.prepare(
      `INSERT INTO experiment_plan_items (experiment_plan_item_id, experiment_plan_id, program_id, account_id, item_key, experiment_type, title, status, priority, required_datasets_json, runtime_budget_json, config_patch_json, falsification_question, created_at, queued_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const item of input.items) {
      stmt.run(
        item.experiment_plan_item_id,
        item.experiment_plan_id,
        item.program_id,
        item.account_id,
        item.item_key,
        item.experiment_type,
        item.title,
        item.status,
        item.priority,
        JSON.stringify(item.required_datasets),
        JSON.stringify(item.runtime_budget),
        JSON.stringify(item.config_patch),
        item.falsification_question,
        item.created_at,
        item.queued_at ?? null,
      );
    }
    return input.plan;
  },

  async listExperimentPlans(programId: string): Promise<ExperimentPlanRecord[]> {
    if (getDatabaseProvider() === "postgres") {
      const result = await getPostgresPool().query("SELECT * FROM experiment_plans WHERE program_id = $1 ORDER BY created_at DESC", [programId]);
      return result.rows.map(mapExperimentPlan);
    }
    const rows = getDb().prepare("SELECT * FROM experiment_plans WHERE program_id = ? ORDER BY created_at DESC").all(programId) as Record<string, unknown>[];
    return rows.map(mapExperimentPlan);
  },

  async listExperimentPlanItems(programId: string): Promise<ExperimentPlanItemRecord[]> {
    if (getDatabaseProvider() === "postgres") {
      const result = await getPostgresPool().query("SELECT * FROM experiment_plan_items WHERE program_id = $1 ORDER BY created_at DESC, priority DESC", [programId]);
      return result.rows.map(mapExperimentPlanItem);
    }
    const rows = getDb().prepare("SELECT * FROM experiment_plan_items WHERE program_id = ? ORDER BY created_at DESC, priority DESC").all(programId) as Record<string, unknown>[];
    return rows.map(mapExperimentPlanItem);
  },

  async listExperimentJobs(programId: string): Promise<ExperimentJobRecord[]> {
    if (getDatabaseProvider() === "postgres") {
      const result = await getPostgresPool().query("SELECT * FROM experiment_jobs WHERE program_id = $1 ORDER BY created_at DESC, priority DESC", [programId]);
      return result.rows.map(mapExperimentJob);
    }
    const rows = getDb().prepare("SELECT * FROM experiment_jobs WHERE program_id = ? ORDER BY created_at DESC, priority DESC").all(programId) as Record<string, unknown>[];
    return rows.map(mapExperimentJob);
  },

  async listExperimentJobsForAccount(accountId: string): Promise<ExperimentJobRecord[]> {
    if (getDatabaseProvider() === "postgres") {
      const result = await getPostgresPool().query("SELECT * FROM experiment_jobs WHERE account_id = $1 ORDER BY created_at DESC", [accountId]);
      return result.rows.map(mapExperimentJob);
    }
    const rows = getDb().prepare("SELECT * FROM experiment_jobs WHERE account_id = ? ORDER BY created_at DESC").all(accountId) as Record<string, unknown>[];
    return rows.map(mapExperimentJob);
  },

  async findExperimentPlan(planId: string): Promise<ExperimentPlanRecord | undefined> {
    if (getDatabaseProvider() === "postgres") {
      const result = await getPostgresPool().query("SELECT * FROM experiment_plans WHERE experiment_plan_id = $1", [planId]);
      return result.rows[0] ? mapExperimentPlan(result.rows[0]) : undefined;
    }
    const row = getDb().prepare("SELECT * FROM experiment_plans WHERE experiment_plan_id = ?").get(planId) as Record<string, unknown> | undefined;
    return row ? mapExperimentPlan(row) : undefined;
  },

  async findExperimentJob(jobId: string): Promise<ExperimentJobRecord | undefined> {
    if (getDatabaseProvider() === "postgres") {
      const result = await getPostgresPool().query("SELECT * FROM experiment_jobs WHERE experiment_job_id = $1", [jobId]);
      return result.rows[0] ? mapExperimentJob(result.rows[0]) : undefined;
    }
    const row = getDb().prepare("SELECT * FROM experiment_jobs WHERE experiment_job_id = ?").get(jobId) as Record<string, unknown> | undefined;
    return row ? mapExperimentJob(row) : undefined;
  },

  async approveExperimentPlan(input: { experiment_plan_id: string; account_id: string; user_id: string; approved_at: string }): Promise<void> {
    if (getDatabaseProvider() === "postgres") {
      await getPostgresPool().query(
        "UPDATE experiment_plans SET status='approved', approved_at=$1, approved_by_user_id=$2 WHERE experiment_plan_id=$3 AND account_id=$4",
        [input.approved_at, input.user_id, input.experiment_plan_id, input.account_id],
      );
      return;
    }
    getDb().prepare("UPDATE experiment_plans SET status='approved', approved_at=?, approved_by_user_id=? WHERE experiment_plan_id=? AND account_id=?")
      .run(input.approved_at, input.user_id, input.experiment_plan_id, input.account_id);
  },

  async queueExperimentJobs(input: {
    experiment_plan_id: string;
    account_id: string;
    queued_at: string;
    jobs: ExperimentJobRecord[];
    events: ExperimentJobEventRecord[];
  }): Promise<void> {
    if (getDatabaseProvider() === "postgres") {
      await getPostgresPool().query("UPDATE experiment_plans SET status='queued', queued_at=$1 WHERE experiment_plan_id=$2 AND account_id=$3", [
        input.queued_at,
        input.experiment_plan_id,
        input.account_id,
      ]);
      await getPostgresPool().query("UPDATE experiment_plan_items SET status='queued', queued_at=$1 WHERE experiment_plan_id=$2 AND account_id=$3 AND status='draft'", [
        input.queued_at,
        input.experiment_plan_id,
        input.account_id,
      ]);
      for (const job of input.jobs) {
        await getPostgresPool().query(
          `INSERT INTO experiment_jobs (experiment_job_id, experiment_plan_item_id, experiment_plan_id, program_id, account_id, status, priority, progress_pct, current_step, retry_count, max_attempts, available_at, leased_until, last_error, created_at, updated_at, started_at, finished_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
           ON CONFLICT (experiment_job_id) DO NOTHING`,
          [
            job.experiment_job_id,
            job.experiment_plan_item_id,
            job.experiment_plan_id,
            job.program_id,
            job.account_id,
            job.status,
            job.priority,
            job.progress_pct,
            job.current_step,
            job.retry_count,
            job.max_attempts,
            job.available_at,
            job.leased_until ?? null,
            job.last_error ?? null,
            job.created_at,
            job.updated_at,
            job.started_at ?? null,
            job.finished_at ?? null,
          ],
        );
      }
      for (const event of input.events) {
        await getPostgresPool().query(
          `INSERT INTO experiment_job_events (experiment_job_event_id, experiment_job_id, experiment_plan_id, program_id, account_id, event_type, message, payload_json, actor_user_id, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            event.experiment_job_event_id,
            event.experiment_job_id,
            event.experiment_plan_id,
            event.program_id,
            event.account_id,
            event.event_type,
            event.message,
            JSON.stringify(event.payload),
            event.actor_user_id ?? null,
            event.created_at,
          ],
        );
      }
      return;
    }
    const db = getDb();
    db.prepare("UPDATE experiment_plans SET status='queued', queued_at=? WHERE experiment_plan_id=? AND account_id=?").run(input.queued_at, input.experiment_plan_id, input.account_id);
    db.prepare("UPDATE experiment_plan_items SET status='queued', queued_at=? WHERE experiment_plan_id=? AND account_id=? AND status='draft'").run(input.queued_at, input.experiment_plan_id, input.account_id);
    const jobStmt = db.prepare(
      `INSERT OR IGNORE INTO experiment_jobs (experiment_job_id, experiment_plan_item_id, experiment_plan_id, program_id, account_id, status, priority, progress_pct, current_step, retry_count, max_attempts, available_at, leased_until, last_error, created_at, updated_at, started_at, finished_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const job of input.jobs) {
      jobStmt.run(job.experiment_job_id, job.experiment_plan_item_id, job.experiment_plan_id, job.program_id, job.account_id, job.status, job.priority, job.progress_pct, job.current_step, job.retry_count, job.max_attempts, job.available_at, job.leased_until ?? null, job.last_error ?? null, job.created_at, job.updated_at, job.started_at ?? null, job.finished_at ?? null);
    }
    const eventStmt = db.prepare(
      `INSERT INTO experiment_job_events (experiment_job_event_id, experiment_job_id, experiment_plan_id, program_id, account_id, event_type, message, payload_json, actor_user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const event of input.events) {
      eventStmt.run(event.experiment_job_event_id, event.experiment_job_id, event.experiment_plan_id, event.program_id, event.account_id, event.event_type, event.message, JSON.stringify(event.payload), event.actor_user_id ?? null, event.created_at);
    }
  },

  async updateExperimentJob(input: { job_id: string; account_id: string; patch: Partial<ExperimentJobRecord>; event?: ExperimentJobEventRecord }): Promise<void> {
    const now = input.patch.updated_at ?? new Date().toISOString();
    if (getDatabaseProvider() === "postgres") {
      const current = await this.findExperimentJob(input.job_id);
      if (!current || current.account_id !== input.account_id) return;
      const next = { ...current, ...input.patch, updated_at: now };
      await getPostgresPool().query(
        `UPDATE experiment_jobs SET status=$1, priority=$2, progress_pct=$3, current_step=$4, retry_count=$5, max_attempts=$6, available_at=$7, leased_until=$8, last_error=$9, updated_at=$10, started_at=$11, finished_at=$12
         WHERE experiment_job_id=$13 AND account_id=$14`,
        [next.status, next.priority, next.progress_pct, next.current_step, next.retry_count, next.max_attempts, next.available_at, next.leased_until ?? null, next.last_error ?? null, next.updated_at, next.started_at ?? null, next.finished_at ?? null, input.job_id, input.account_id],
      );
      if (input.event) {
        await getPostgresPool().query(
          `INSERT INTO experiment_job_events (experiment_job_event_id, experiment_job_id, experiment_plan_id, program_id, account_id, event_type, message, payload_json, actor_user_id, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [input.event.experiment_job_event_id, input.event.experiment_job_id, input.event.experiment_plan_id, input.event.program_id, input.event.account_id, input.event.event_type, input.event.message, JSON.stringify(input.event.payload), input.event.actor_user_id ?? null, input.event.created_at],
        );
      }
      return;
    }
    const current = await this.findExperimentJob(input.job_id);
    if (!current || current.account_id !== input.account_id) return;
    const next = { ...current, ...input.patch, updated_at: now };
    getDb().prepare(
      `UPDATE experiment_jobs SET status=?, priority=?, progress_pct=?, current_step=?, retry_count=?, max_attempts=?, available_at=?, leased_until=?, last_error=?, updated_at=?, started_at=?, finished_at=?
       WHERE experiment_job_id=? AND account_id=?`,
    ).run(next.status, next.priority, next.progress_pct, next.current_step, next.retry_count, next.max_attempts, next.available_at, next.leased_until ?? null, next.last_error ?? null, next.updated_at, next.started_at ?? null, next.finished_at ?? null, input.job_id, input.account_id);
    if (input.event) {
      getDb().prepare(
        `INSERT INTO experiment_job_events (experiment_job_event_id, experiment_job_id, experiment_plan_id, program_id, account_id, event_type, message, payload_json, actor_user_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(input.event.experiment_job_event_id, input.event.experiment_job_id, input.event.experiment_plan_id, input.event.program_id, input.event.account_id, input.event.event_type, input.event.message, JSON.stringify(input.event.payload), input.event.actor_user_id ?? null, input.event.created_at);
    }
  },

  async attachAnalysis(input: {
    program_artifact_id: string;
    program_id: string;
    account_id: string;
    artifact_id?: string;
    analysis_id: string;
    attached_by_user_id: string;
    created_at: string;
  }): Promise<void> {
    if (getDatabaseProvider() === "postgres") {
      await getPostgresPool().query("UPDATE analyses SET program_id = $1, updated_at = $2 WHERE analysis_id = $3 AND account_id = $4", [
        input.program_id,
        input.created_at,
        input.analysis_id,
        input.account_id,
      ]);
      await getPostgresPool().query(
        `INSERT INTO program_artifacts (program_artifact_id, program_id, account_id, artifact_id, analysis_id, artifact_role, attached_by_user_id, created_at)
         VALUES ($1,$2,$3,$4,$5,'audit_import',$6,$7)
         ON CONFLICT DO NOTHING`,
        [input.program_artifact_id, input.program_id, input.account_id, input.artifact_id ?? null, input.analysis_id, input.attached_by_user_id, input.created_at],
      );
      await getPostgresPool().query("UPDATE research_programs SET next_action = $1, updated_at = $2 WHERE program_id = $3", [
        "Review the imported evidence and decide the next falsification experiment.",
        input.created_at,
        input.program_id,
      ]);
      return;
    }
    getDb()
      .prepare("UPDATE analyses SET program_id = ?, updated_at = ? WHERE analysis_id = ? AND account_id = ?")
      .run(input.program_id, input.created_at, input.analysis_id, input.account_id);
    getDb()
      .prepare(
        `INSERT OR IGNORE INTO program_artifacts (program_artifact_id, program_id, account_id, artifact_id, analysis_id, artifact_role, attached_by_user_id, created_at)
         VALUES (?, ?, ?, ?, ?, 'audit_import', ?, ?)`,
      )
      .run(input.program_artifact_id, input.program_id, input.account_id, input.artifact_id ?? null, input.analysis_id, input.attached_by_user_id, input.created_at);
    getDb()
      .prepare("UPDATE research_programs SET next_action = ?, updated_at = ? WHERE program_id = ?")
      .run("Review the imported evidence and decide the next falsification experiment.", input.created_at, input.program_id);
  },
};
