import { getDb } from "@/lib/server/persistence/database";
import { getDatabaseProvider } from "@/lib/server/persistence/provider";
import { getPostgresPool } from "@/lib/server/persistence/postgres";
import type {
  CopilotConversationDetail,
  ResearchConversation,
  ResearchMessage,
  ResearchProposal,
  ResearchSource,
  ResearchSourceChunk,
  ResearchTurn,
} from "@/lib/server/research-copilot/models";

function iso(value: unknown) {
  return value instanceof Date ? value.toISOString() : String(value);
}

function json<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  return (typeof value === "string" ? JSON.parse(value) : value) as T;
}

function mapConversation(row: Record<string, unknown>): ResearchConversation {
  return {
    conversation_id: String(row.conversation_id),
    program_id: String(row.program_id),
    account_id: String(row.account_id),
    created_by_user_id: String(row.created_by_user_id),
    title: String(row.title),
    status: row.status as ResearchConversation["status"],
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
  };
}

function mapMessage(row: Record<string, unknown>): ResearchMessage {
  return {
    message_id: String(row.message_id),
    conversation_id: String(row.conversation_id),
    program_id: String(row.program_id),
    account_id: String(row.account_id),
    role: row.role as ResearchMessage["role"],
    content: String(row.content),
    parts: json(row.parts_json, []),
    status: row.status as ResearchMessage["status"],
    reply_to_message_id: row.reply_to_message_id ? String(row.reply_to_message_id) : undefined,
    created_by_user_id: row.created_by_user_id ? String(row.created_by_user_id) : undefined,
    created_at: iso(row.created_at),
  };
}

function mapSource(row: Record<string, unknown>): ResearchSource {
  return {
    source_id: String(row.source_id),
    program_id: String(row.program_id),
    account_id: String(row.account_id),
    created_by_user_id: String(row.created_by_user_id),
    source_type: row.source_type as ResearchSource["source_type"],
    title: String(row.title),
    canonical_url: row.canonical_url ? String(row.canonical_url) : undefined,
    file_name: row.file_name ? String(row.file_name) : undefined,
    content_type: String(row.content_type),
    storage_key: row.storage_key ? String(row.storage_key) : undefined,
    checksum_sha256: String(row.checksum_sha256),
    size_bytes: Number(row.size_bytes),
    status: row.status as ResearchSource["status"],
    metadata: json(row.metadata_json, {}),
    error_summary: row.error_summary ? String(row.error_summary) : undefined,
    created_at: iso(row.created_at),
  };
}

function mapChunk(row: Record<string, unknown>): ResearchSourceChunk {
  return {
    chunk_id: String(row.chunk_id),
    source_id: String(row.source_id),
    program_id: String(row.program_id),
    account_id: String(row.account_id),
    chunk_index: Number(row.chunk_index),
    content: String(row.content),
    anchor: json(row.anchor_json, {}),
    token_estimate: Number(row.token_estimate),
    created_at: iso(row.created_at),
  };
}

function mapProposal(row: Record<string, unknown>): ResearchProposal {
  return {
    proposal_id: String(row.proposal_id),
    conversation_id: String(row.conversation_id),
    program_id: String(row.program_id),
    account_id: String(row.account_id),
    source_message_id: String(row.source_message_id),
    proposal_type: row.proposal_type as ResearchProposal["proposal_type"],
    status: row.status as ResearchProposal["status"],
    title: String(row.title),
    payload: json(row.payload_json, {}),
    provenance: json(row.provenance_json, {}),
    version: Number(row.version),
    content_hash: String(row.content_hash),
    created_at: iso(row.created_at),
    confirmed_at: row.confirmed_at ? iso(row.confirmed_at) : undefined,
    confirmed_by_user_id: row.confirmed_by_user_id ? String(row.confirmed_by_user_id) : undefined,
  };
}

async function rows(sqlPg: string, sqlSqlite: string, params: unknown[]) {
  if (getDatabaseProvider() === "postgres") return (await getPostgresPool().query(sqlPg, params)).rows as Record<string, unknown>[];
  return getDb().prepare(sqlSqlite).all(...params) as Record<string, unknown>[];
}

export const researchCopilotRepository = {
  async saveConversation(value: ResearchConversation) {
    const params = [value.conversation_id, value.program_id, value.account_id, value.created_by_user_id, value.title, value.status, value.created_at, value.updated_at];
    if (getDatabaseProvider() === "postgres") {
      await getPostgresPool().query(`INSERT INTO research_conversations (conversation_id, program_id, account_id, created_by_user_id, title, status, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, params);
    } else {
      getDb().prepare(`INSERT INTO research_conversations (conversation_id, program_id, account_id, created_by_user_id, title, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)`).run(...params);
    }
    return value;
  },

  async findDefaultConversation(programId: string) {
    const result = await rows(
      "SELECT * FROM research_conversations WHERE program_id = $1 AND status = 'active' ORDER BY created_at ASC LIMIT 1",
      "SELECT * FROM research_conversations WHERE program_id = ? AND status = 'active' ORDER BY created_at ASC LIMIT 1",
      [programId],
    );
    return result[0] ? mapConversation(result[0]) : undefined;
  },

  async touchConversation(conversationId: string, updatedAt: string) {
    if (getDatabaseProvider() === "postgres") await getPostgresPool().query("UPDATE research_conversations SET updated_at = $2 WHERE conversation_id = $1", [conversationId, updatedAt]);
    else getDb().prepare("UPDATE research_conversations SET updated_at = ? WHERE conversation_id = ?").run(updatedAt, conversationId);
  },

  async saveMessage(value: ResearchMessage) {
    const params = [value.message_id, value.conversation_id, value.program_id, value.account_id, value.role, value.content, JSON.stringify(value.parts), value.status, value.reply_to_message_id ?? null, value.created_by_user_id ?? null, value.created_at];
    if (getDatabaseProvider() === "postgres") await getPostgresPool().query(`INSERT INTO research_messages (message_id, conversation_id, program_id, account_id, role, content, parts_json, status, reply_to_message_id, created_by_user_id, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, params);
    else getDb().prepare(`INSERT INTO research_messages (message_id, conversation_id, program_id, account_id, role, content, parts_json, status, reply_to_message_id, created_by_user_id, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(...params);
    return value;
  },

  async listMessages(conversationId: string) {
    return (await rows("SELECT * FROM research_messages WHERE conversation_id = $1 ORDER BY created_at ASC", "SELECT * FROM research_messages WHERE conversation_id = ? ORDER BY created_at ASC", [conversationId])).map(mapMessage);
  },

  async saveTurn(value: ResearchTurn) {
    const params = [value.turn_id, value.conversation_id, value.program_id, value.account_id, value.user_message_id, value.assistant_message_id ?? null, value.provider, value.model ?? null, value.prompt_version, value.tool_version, value.status, value.mode ?? null, value.prompt_tokens ?? null, value.completion_tokens ?? null, value.duration_ms ?? null, value.error_code ?? null, value.created_at, value.completed_at ?? null];
    if (getDatabaseProvider() === "postgres") await getPostgresPool().query(`INSERT INTO research_turns (turn_id, conversation_id, program_id, account_id, user_message_id, assistant_message_id, provider, model, prompt_version, tool_version, status, mode, prompt_tokens, completion_tokens, duration_ms, error_code, created_at, completed_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`, params);
    else getDb().prepare(`INSERT INTO research_turns (turn_id, conversation_id, program_id, account_id, user_message_id, assistant_message_id, provider, model, prompt_version, tool_version, status, mode, prompt_tokens, completion_tokens, duration_ms, error_code, created_at, completed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(...params);
    return value;
  },

  async completeTurn(turnId: string, patch: Partial<ResearchTurn>) {
    const params = [turnId, patch.assistant_message_id ?? null, patch.provider ?? "deterministic", patch.model ?? null, patch.status ?? "completed", patch.mode ?? null, patch.prompt_tokens ?? null, patch.completion_tokens ?? null, patch.duration_ms ?? null, patch.error_code ?? null, patch.completed_at ?? new Date().toISOString()];
    if (getDatabaseProvider() === "postgres") await getPostgresPool().query(`UPDATE research_turns SET assistant_message_id=$2, provider=$3, model=$4, status=$5, mode=$6, prompt_tokens=$7, completion_tokens=$8, duration_ms=$9, error_code=$10, completed_at=$11 WHERE turn_id=$1`, params);
    else getDb().prepare(`UPDATE research_turns SET assistant_message_id=?, provider=?, model=?, status=?, mode=?, prompt_tokens=?, completion_tokens=?, duration_ms=?, error_code=?, completed_at=? WHERE turn_id=?`).run(...params.slice(1), params[0]);
  },

  async saveSource(value: ResearchSource) {
    const params = [value.source_id, value.program_id, value.account_id, value.created_by_user_id, value.source_type, value.title, value.canonical_url ?? null, value.file_name ?? null, value.content_type, value.storage_key ?? null, value.checksum_sha256, value.size_bytes, value.status, JSON.stringify(value.metadata), value.error_summary ?? null, value.created_at];
    if (getDatabaseProvider() === "postgres") await getPostgresPool().query(`INSERT INTO research_sources (source_id, program_id, account_id, created_by_user_id, source_type, title, canonical_url, file_name, content_type, storage_key, checksum_sha256, size_bytes, status, metadata_json, error_summary, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`, params);
    else getDb().prepare(`INSERT INTO research_sources (source_id, program_id, account_id, created_by_user_id, source_type, title, canonical_url, file_name, content_type, storage_key, checksum_sha256, size_bytes, status, metadata_json, error_summary, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(...params);
    return value;
  },

  async saveChunks(values: ResearchSourceChunk[]) {
    for (const value of values) {
      const params = [value.chunk_id, value.source_id, value.program_id, value.account_id, value.chunk_index, value.content, JSON.stringify(value.anchor), value.token_estimate, value.created_at];
      if (getDatabaseProvider() === "postgres") await getPostgresPool().query(`INSERT INTO research_source_chunks (chunk_id, source_id, program_id, account_id, chunk_index, content, anchor_json, token_estimate, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, params);
      else getDb().prepare(`INSERT INTO research_source_chunks (chunk_id, source_id, program_id, account_id, chunk_index, content, anchor_json, token_estimate, created_at) VALUES (?,?,?,?,?,?,?,?,?)`).run(...params);
    }
    return values;
  },

  async listSources(programId: string) {
    return (await rows("SELECT * FROM research_sources WHERE program_id = $1 ORDER BY created_at DESC", "SELECT * FROM research_sources WHERE program_id = ? ORDER BY created_at DESC", [programId])).map(mapSource);
  },

  async listSourceChunks(programId: string) {
    return (await rows("SELECT * FROM research_source_chunks WHERE program_id = $1 ORDER BY source_id, chunk_index", "SELECT * FROM research_source_chunks WHERE program_id = ? ORDER BY source_id, chunk_index", [programId])).map(mapChunk);
  },

  async saveProposal(value: ResearchProposal) {
    const params = [value.proposal_id, value.conversation_id, value.program_id, value.account_id, value.source_message_id, value.proposal_type, value.status, value.title, JSON.stringify(value.payload), JSON.stringify(value.provenance), value.version, value.content_hash, value.created_at, value.confirmed_at ?? null, value.confirmed_by_user_id ?? null];
    if (getDatabaseProvider() === "postgres") await getPostgresPool().query(`INSERT INTO research_proposals (proposal_id, conversation_id, program_id, account_id, source_message_id, proposal_type, status, title, payload_json, provenance_json, version, content_hash, created_at, confirmed_at, confirmed_by_user_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`, params);
    else getDb().prepare(`INSERT INTO research_proposals (proposal_id, conversation_id, program_id, account_id, source_message_id, proposal_type, status, title, payload_json, provenance_json, version, content_hash, created_at, confirmed_at, confirmed_by_user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(...params);
    return value;
  },

  async listProposals(programId: string) {
    return (await rows("SELECT * FROM research_proposals WHERE program_id = $1 ORDER BY created_at DESC", "SELECT * FROM research_proposals WHERE program_id = ? ORDER BY created_at DESC", [programId])).map(mapProposal);
  },

  async decideProposal(input: { proposalId: string; accountId: string; actorUserId: string; decision: "confirmed" | "rejected"; decisionId: string; createdAt: string }) {
    const proposalRows = await rows("SELECT * FROM research_proposals WHERE proposal_id=$1 AND account_id=$2", "SELECT * FROM research_proposals WHERE proposal_id=? AND account_id=?", [input.proposalId, input.accountId]);
    if (!proposalRows[0]) throw new Error("proposal_not_found");
    const proposal = mapProposal(proposalRows[0]);
    if (proposal.status !== "proposed") throw new Error("proposal_already_decided");
    if (getDatabaseProvider() === "postgres") {
      await getPostgresPool().query("UPDATE research_proposals SET status=$2, confirmed_at=CASE WHEN $2='confirmed' THEN $3::timestamptz ELSE NULL END, confirmed_by_user_id=CASE WHEN $2='confirmed' THEN $4 ELSE NULL END WHERE proposal_id=$1", [input.proposalId, input.decision, input.createdAt, input.actorUserId]);
      await getPostgresPool().query("INSERT INTO research_decisions (decision_id, conversation_id, program_id, account_id, proposal_id, actor_user_id, decision_type, payload_json, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)", [input.decisionId, proposal.conversation_id, proposal.program_id, proposal.account_id, proposal.proposal_id, input.actorUserId, input.decision, JSON.stringify({ content_hash: proposal.content_hash, version: proposal.version }), input.createdAt]);
    } else {
      getDb().prepare("UPDATE research_proposals SET status=?, confirmed_at=?, confirmed_by_user_id=? WHERE proposal_id=?").run(input.decision, input.decision === "confirmed" ? input.createdAt : null, input.decision === "confirmed" ? input.actorUserId : null, input.proposalId);
      getDb().prepare("INSERT INTO research_decisions (decision_id, conversation_id, program_id, account_id, proposal_id, actor_user_id, decision_type, payload_json, created_at) VALUES (?,?,?,?,?,?,?,?,?)").run(input.decisionId, proposal.conversation_id, proposal.program_id, proposal.account_id, proposal.proposal_id, input.actorUserId, input.decision, JSON.stringify({ content_hash: proposal.content_hash, version: proposal.version }), input.createdAt);
    }
  },

  async saveContextSnapshot(value: { context_snapshot_id: string; turn_id: string; conversation_id: string; program_id: string; account_id: string; included_message_ids: string[]; included_source_chunks: string[]; included_artifact_ids: string[]; token_estimate: number; policy_version: string; created_at: string }) {
    const params = [value.context_snapshot_id, value.turn_id, value.conversation_id, value.program_id, value.account_id, JSON.stringify(value.included_message_ids), JSON.stringify(value.included_source_chunks), JSON.stringify(value.included_artifact_ids), value.token_estimate, value.policy_version, value.created_at];
    if (getDatabaseProvider() === "postgres") await getPostgresPool().query(`INSERT INTO conversation_context_snapshots (context_snapshot_id, turn_id, conversation_id, program_id, account_id, included_message_ids_json, included_source_chunks_json, included_artifact_ids_json, token_estimate, policy_version, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, params);
    else getDb().prepare(`INSERT INTO conversation_context_snapshots (context_snapshot_id, turn_id, conversation_id, program_id, account_id, included_message_ids_json, included_source_chunks_json, included_artifact_ids_json, token_estimate, policy_version, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(...params);
  },

  async saveToolCall(value: { tool_call_id: string; turn_id: string; conversation_id: string; program_id: string; account_id: string; tool_name: string; arguments: Record<string, unknown>; result?: unknown; authorization_decision: "allowed" | "denied" | "confirmation_required"; status: "completed" | "failed" | "denied"; idempotency_key: string; error_code?: string; created_at: string; completed_at?: string }) {
    const params = [value.tool_call_id, value.turn_id, value.conversation_id, value.program_id, value.account_id, value.tool_name, JSON.stringify(value.arguments), value.result === undefined ? null : JSON.stringify(value.result), value.authorization_decision, value.status, value.idempotency_key, value.error_code ?? null, value.created_at, value.completed_at ?? null];
    if (getDatabaseProvider() === "postgres") await getPostgresPool().query(`INSERT INTO research_tool_calls (tool_call_id, turn_id, conversation_id, program_id, account_id, tool_name, arguments_json, result_json, authorization_decision, status, idempotency_key, error_code, created_at, completed_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT (idempotency_key) DO NOTHING`, params);
    else getDb().prepare(`INSERT OR IGNORE INTO research_tool_calls (tool_call_id, turn_id, conversation_id, program_id, account_id, tool_name, arguments_json, result_json, authorization_decision, status, idempotency_key, error_code, created_at, completed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(...params);
  },

  async getDetail(programId: string): Promise<CopilotConversationDetail | undefined> {
    const conversation = await this.findDefaultConversation(programId);
    if (!conversation) return undefined;
    return {
      conversation,
      messages: await this.listMessages(conversation.conversation_id),
      sources: await this.listSources(programId),
      source_chunks: await this.listSourceChunks(programId),
      proposals: await this.listProposals(programId),
    };
  },

  async getOpsSnapshot() {
    const select = async (pg: string, sqlite: string) => Number((await rows(pg, sqlite, []))[0]?.count ?? 0);
    const usage = (await rows(
      "SELECT COALESCE(SUM(prompt_tokens),0)::bigint AS prompt_tokens, COALESCE(SUM(completion_tokens),0)::bigint AS completion_tokens, COALESCE(AVG(duration_ms),0)::bigint AS average_duration_ms FROM research_turns WHERE created_at >= NOW() - INTERVAL '24 hours'",
      "SELECT COALESCE(SUM(prompt_tokens),0) AS prompt_tokens, COALESCE(SUM(completion_tokens),0) AS completion_tokens, COALESCE(AVG(duration_ms),0) AS average_duration_ms FROM research_turns WHERE created_at >= datetime('now', '-1 day')",
      [],
    ))[0] ?? {};
    const promptTokens = Number(usage.prompt_tokens ?? 0);
    const completionTokens = Number(usage.completion_tokens ?? 0);
    const inputCostPerMillion = Number(process.env.LLM_INPUT_COST_PER_MILLION_USD ?? 0);
    const outputCostPerMillion = Number(process.env.LLM_OUTPUT_COST_PER_MILLION_USD ?? 0);
    return {
      turns_24h: await select("SELECT COUNT(*)::int AS count FROM research_turns WHERE created_at >= NOW() - INTERVAL '24 hours'", "SELECT COUNT(*) AS count FROM research_turns WHERE created_at >= datetime('now', '-1 day')"),
      failed_turns_24h: await select("SELECT COUNT(*)::int AS count FROM research_turns WHERE status='failed' AND created_at >= NOW() - INTERVAL '24 hours'", "SELECT COUNT(*) AS count FROM research_turns WHERE status='failed' AND created_at >= datetime('now', '-1 day')"),
      ingestion_failures_24h: await select("SELECT COUNT(*)::int AS count FROM research_sources WHERE status='failed' AND created_at >= NOW() - INTERVAL '24 hours'", "SELECT COUNT(*) AS count FROM research_sources WHERE status='failed' AND created_at >= datetime('now', '-1 day')"),
      pending_proposals: await select("SELECT COUNT(*)::int AS count FROM research_proposals WHERE status='proposed'", "SELECT COUNT(*) AS count FROM research_proposals WHERE status='proposed'"),
      failed_tool_calls_24h: await select("SELECT COUNT(*)::int AS count FROM research_tool_calls WHERE status='failed' AND created_at >= NOW() - INTERVAL '24 hours'", "SELECT COUNT(*) AS count FROM research_tool_calls WHERE status='failed' AND created_at >= datetime('now', '-1 day')"),
      prompt_tokens_24h: promptTokens,
      completion_tokens_24h: completionTokens,
      average_duration_ms_24h: Number(usage.average_duration_ms ?? 0),
      estimated_cost_usd_24h: (promptTokens * inputCostPerMillion + completionTokens * outputCostPerMillion) / 1_000_000,
    };
  },
};
