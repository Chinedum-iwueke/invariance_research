import type { ResearchLifecycleEvent } from "@/lib/contracts/research-lifecycle";
import { getDb } from "@/lib/server/persistence/database";
import { getDatabaseProvider } from "@/lib/server/persistence/provider";
import { getPostgresPool } from "@/lib/server/persistence/postgres";
import type { HypothesisCardRecord, ResearchSpecBridgeDetail, ResearchSpecBundleRecord, StrategyImplementationTaskRecord } from "@/lib/server/research-specs-v2/models";

function iso(value: unknown) { return value instanceof Date ? value.toISOString() : String(value); }
function json<T>(value: unknown, fallback: T): T { if (value === null || value === undefined) return fallback; return (typeof value === "string" ? JSON.parse(value) : value) as T; }
async function rows(pg: string, sqlite: string, params: unknown[]) { return getDatabaseProvider() === "postgres" ? (await getPostgresPool().query(pg, params)).rows as Record<string, unknown>[] : getDb().prepare(sqlite).all(...params) as Record<string, unknown>[]; }

function mapCard(row: Record<string, unknown>): HypothesisCardRecord {
  return { card_record_id: String(row.card_record_id), card_id: String(row.card_id), program_id: String(row.program_id), account_id: String(row.account_id), source_proposal_id: row.source_proposal_id ? String(row.source_proposal_id) : undefined, version: Number(row.version), status: row.status as HypothesisCardRecord["status"], card: json(row.card_json, undefined as never), card_hash: String(row.card_hash), validation_errors: json(row.validation_errors_json, []), created_by_user_id: String(row.created_by_user_id), created_at: iso(row.created_at), confirmed_at: row.confirmed_at ? iso(row.confirmed_at) : undefined, confirmed_by_user_id: row.confirmed_by_user_id ? String(row.confirmed_by_user_id) : undefined };
}
function mapBundle(row: Record<string, unknown>): ResearchSpecBundleRecord {
  return { spec_bundle_id: String(row.spec_bundle_id), program_id: String(row.program_id), account_id: String(row.account_id), card_record_id: String(row.card_record_id), version: Number(row.version), status: row.status as ResearchSpecBundleRecord["status"], bundle: json(row.bundle_json, undefined as never), bundle_hash: String(row.bundle_hash), compile_status: row.compile_status as ResearchSpecBundleRecord["compile_status"], compiler_version: String(row.compiler_version), validation_errors: json(row.validation_errors_json, []), generated_by_user_id: String(row.generated_by_user_id), generated_at: iso(row.generated_at), approved_at: row.approved_at ? iso(row.approved_at) : undefined, approved_by_user_id: row.approved_by_user_id ? String(row.approved_by_user_id) : undefined };
}
function mapTask(row: Record<string, unknown>): StrategyImplementationTaskRecord {
  return { task_id: String(row.task_id), program_id: String(row.program_id), account_id: String(row.account_id), spec_bundle_id: String(row.spec_bundle_id), status: row.status as StrategyImplementationTaskRecord["status"], task: json(row.task_json, {}), evidence: json(row.evidence_json, {}), created_at: iso(row.created_at) };
}

export const researchSpecV2Repository = {
  async list(programId: string, accountId: string): Promise<ResearchSpecBridgeDetail> {
    const params = [programId, accountId];
    const [cards, bundles, tasks] = await Promise.all([
      rows("SELECT * FROM hypothesis_cards WHERE program_id=$1 AND account_id=$2 ORDER BY created_at DESC", "SELECT * FROM hypothesis_cards WHERE program_id=? AND account_id=? ORDER BY created_at DESC", params),
      rows("SELECT * FROM research_spec_bundles WHERE program_id=$1 AND account_id=$2 ORDER BY generated_at DESC", "SELECT * FROM research_spec_bundles WHERE program_id=? AND account_id=? ORDER BY generated_at DESC", params),
      rows("SELECT * FROM strategy_implementation_tasks WHERE program_id=$1 AND account_id=$2 ORDER BY created_at DESC", "SELECT * FROM strategy_implementation_tasks WHERE program_id=? AND account_id=? ORDER BY created_at DESC", params),
    ]);
    return { cards: cards.map(mapCard), bundles: bundles.map(mapBundle), implementation_tasks: tasks.map(mapTask) };
  },
  async findCard(recordId: string, accountId: string) {
    const result = await rows("SELECT * FROM hypothesis_cards WHERE card_record_id=$1 AND account_id=$2", "SELECT * FROM hypothesis_cards WHERE card_record_id=? AND account_id=?", [recordId, accountId]);
    return result[0] ? mapCard(result[0]) : undefined;
  },
  async saveCard(value: HypothesisCardRecord) {
    const params = [value.card_record_id, value.card_id, value.program_id, value.account_id, value.source_proposal_id ?? null, value.version, value.status, JSON.stringify(value.card), value.card_hash, JSON.stringify(value.validation_errors), value.created_by_user_id, value.created_at, value.confirmed_at ?? null, value.confirmed_by_user_id ?? null];
    if (getDatabaseProvider() === "postgres") await getPostgresPool().query("INSERT INTO hypothesis_cards (card_record_id,card_id,program_id,account_id,source_proposal_id,version,status,card_json,card_hash,validation_errors_json,created_by_user_id,created_at,confirmed_at,confirmed_by_user_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)", params);
    else getDb().prepare("INSERT INTO hypothesis_cards (card_record_id,card_id,program_id,account_id,source_proposal_id,version,status,card_json,card_hash,validation_errors_json,created_by_user_id,created_at,confirmed_at,confirmed_by_user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(...params);
    return value;
  },
  async saveBundle(value: ResearchSpecBundleRecord) {
    const params = [value.spec_bundle_id, value.program_id, value.account_id, value.card_record_id, value.version, value.status, JSON.stringify(value.bundle), value.bundle_hash, value.compile_status, value.compiler_version, JSON.stringify(value.validation_errors), value.generated_by_user_id, value.generated_at, value.approved_at ?? null, value.approved_by_user_id ?? null];
    if (getDatabaseProvider() === "postgres") await getPostgresPool().query("INSERT INTO research_spec_bundles (spec_bundle_id,program_id,account_id,card_record_id,version,status,bundle_json,bundle_hash,compile_status,compiler_version,validation_errors_json,generated_by_user_id,generated_at,approved_at,approved_by_user_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)", params);
    else getDb().prepare("INSERT INTO research_spec_bundles (spec_bundle_id,program_id,account_id,card_record_id,version,status,bundle_json,bundle_hash,compile_status,compiler_version,validation_errors_json,generated_by_user_id,generated_at,approved_at,approved_by_user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(...params);
    return value;
  },
  async approveBundle(bundleId: string, accountId: string, userId: string, now: string) {
    if (getDatabaseProvider() === "postgres") await getPostgresPool().query("UPDATE research_spec_bundles SET status='approved',approved_at=$3,approved_by_user_id=$4 WHERE spec_bundle_id=$1 AND account_id=$2", [bundleId, accountId, now, userId]);
    else getDb().prepare("UPDATE research_spec_bundles SET status='approved',approved_at=?,approved_by_user_id=? WHERE spec_bundle_id=? AND account_id=?").run(now, userId, bundleId, accountId);
  },
  async saveTask(value: StrategyImplementationTaskRecord) {
    const params = [value.task_id, value.program_id, value.account_id, value.spec_bundle_id, value.status, JSON.stringify(value.task), JSON.stringify(value.evidence), value.created_at];
    if (getDatabaseProvider() === "postgres") await getPostgresPool().query("INSERT INTO strategy_implementation_tasks (task_id,program_id,account_id,spec_bundle_id,status,task_json,evidence_json,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", params);
    else getDb().prepare("INSERT INTO strategy_implementation_tasks (task_id,program_id,account_id,spec_bundle_id,status,task_json,evidence_json,created_at) VALUES (?,?,?,?,?,?,?,?)").run(...params);
    return value;
  },
  async findTask(taskId: string, accountId: string) {
    const result = await rows("SELECT * FROM strategy_implementation_tasks WHERE task_id=$1 AND account_id=$2", "SELECT * FROM strategy_implementation_tasks WHERE task_id=? AND account_id=?", [taskId, accountId]);
    return result[0] ? mapTask(result[0]) : undefined;
  },
  async updateTask(input: { taskId: string; accountId: string; status: StrategyImplementationTaskRecord["status"]; evidence: Record<string, unknown>; approvedAt?: string; approvedByUserId?: string }) {
    if (getDatabaseProvider() === "postgres") await getPostgresPool().query("UPDATE strategy_implementation_tasks SET status=$3,evidence_json=$4,approved_at=$5,approved_by_user_id=$6 WHERE task_id=$1 AND account_id=$2", [input.taskId, input.accountId, input.status, JSON.stringify(input.evidence), input.approvedAt ?? null, input.approvedByUserId ?? null]);
    else getDb().prepare("UPDATE strategy_implementation_tasks SET status=?,evidence_json=?,approved_at=?,approved_by_user_id=? WHERE task_id=? AND account_id=?").run(input.status, JSON.stringify(input.evidence), input.approvedAt ?? null, input.approvedByUserId ?? null, input.taskId, input.accountId);
  },
  async appendLifecycle(event: ResearchLifecycleEvent & { event_hash: string }) {
    const params = [event.event_id, event.identity.program_id, event.identity.account_id, event.schema_version, event.event_type, event.occurred_at, event.identity.stage, JSON.stringify(event.identity), JSON.stringify(event.payload), JSON.stringify(event.actor), event.event_hash, event.occurred_at];
    if (getDatabaseProvider() === "postgres") await getPostgresPool().query("INSERT INTO program_lifecycle_events (event_id,program_id,account_id,schema_version,event_type,occurred_at,stage,identity_json,payload_json,actor_json,event_hash,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (event_hash) DO NOTHING", params);
    else getDb().prepare("INSERT OR IGNORE INTO program_lifecycle_events (event_id,program_id,account_id,schema_version,event_type,occurred_at,stage,identity_json,payload_json,actor_json,event_hash,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").run(...params);
  },
};
