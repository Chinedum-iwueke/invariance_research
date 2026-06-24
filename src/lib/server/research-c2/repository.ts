import { getDb } from "@/lib/server/persistence/database";
import { getDatabaseProvider } from "@/lib/server/persistence/provider";
import { getPostgresPool } from "@/lib/server/persistence/postgres";
import { canonicalHash } from "@/lib/server/research-c2/contracts";
import type {
  C2ProgramDetail,
  CatalogEntry,
  PineExportJobRecord,
  PineExportRecord,
  QualificationRecord,
} from "@/lib/server/research-c2/models";

const iso = (value: unknown) =>
  value instanceof Date ? value.toISOString() : String(value);
const json = <T>(value: unknown, fallback: T): T =>
  value === null || value === undefined
    ? fallback
    : ((typeof value === "string" ? JSON.parse(value) : value) as T);
async function rows(pg: string, sqlite: string, params: unknown[]) {
  return getDatabaseProvider() === "postgres"
    ? ((await getPostgresPool().query(pg, params)).rows as Record<
        string,
        unknown
      >[])
    : (getDb()
        .prepare(sqlite)
        .all(...params) as Record<string, unknown>[]);
}
function qualification(row: Record<string, unknown>): QualificationRecord {
  return {
    qualification_id: String(row.qualification_id),
    program_id: String(row.program_id),
    account_id: String(row.account_id),
    spec_bundle_id: String(row.spec_bundle_id),
    experiment_job_id: row.experiment_job_id
      ? String(row.experiment_job_id)
      : undefined,
    status: row.status as QualificationRecord["status"],
    strategy_spec_hash: String(row.strategy_spec_hash),
    risk_policy_hash: String(row.risk_policy_hash),
    config_hash: String(row.config_hash),
    snapshot_hash: String(row.snapshot_hash),
    snapshot: json(row.snapshot_json, {}),
    created_by_user_id: String(row.created_by_user_id),
    created_at: iso(row.created_at),
    approved_at: row.approved_at ? iso(row.approved_at) : undefined,
    approved_by_user_id: row.approved_by_user_id
      ? String(row.approved_by_user_id)
      : undefined,
  };
}
function catalog(row: Record<string, unknown>): CatalogEntry {
  const normalized = {
    schema_version: "program_artifact_catalog_entry_v1" as const,
    catalog_id: String(row.catalog_id),
    account_id: String(row.account_id),
    program_id: String(row.program_id),
    artifact_type: row.artifact_type as CatalogEntry["artifact_type"],
    object_id: String(row.object_id),
    sensitivity: row.sensitivity as CatalogEntry["sensitivity"],
    content_hash: String(row.content_hash),
    lineage: json(row.lineage_json, {}),
    summary: String(row.summary),
    searchable_text: String(row.searchable_text),
    anchors: json(row.anchors_json, []),
    schema: json(row.table_schema_json, {}),
    query_payload: json(row.query_payload_json, {}),
    units: json(row.units_json, {}),
    storage_key: row.storage_key ? String(row.storage_key) : undefined,
    status: row.status as CatalogEntry["status"],
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
  };
  const contract=Object.fromEntries(Object.entries(normalized).filter(([key])=>!new Set(["created_at","updated_at"]).has(key)));
  return { ...normalized, catalog_hash: canonicalHash(contract) };
}
function pineExport(row: Record<string, unknown>): PineExportRecord {
  return {
    pine_export_id: String(row.pine_export_id),
    account_id: String(row.account_id),
    program_id: String(row.program_id),
    spec_bundle_id: String(row.spec_bundle_id),
    status: row.status as PineExportRecord["status"],
    compatibility_status: String(row.compatibility_status),
    parity_status: String(row.parity_status),
    bundle_hash: String(row.bundle_hash),
    storage_prefix: String(row.storage_prefix),
    manifest: json(row.manifest_json, {}),
    created_by_user_id: String(row.created_by_user_id),
    created_at: iso(row.created_at),
    superseded_at: row.superseded_at ? iso(row.superseded_at) : undefined,
  };
}

export const c2Repository = {
  async detail(programId: string, accountId: string): Promise<C2ProgramDetail> {
    const p = [programId, accountId];
    const [q, c, e, j, i, r, k, o] = await Promise.all([
      rows(
        "SELECT * FROM deployment_qualifications WHERE program_id=$1 AND account_id=$2 ORDER BY created_at DESC",
        "SELECT * FROM deployment_qualifications WHERE program_id=? AND account_id=? ORDER BY created_at DESC",
        p,
      ),
      rows(
        "SELECT * FROM program_artifact_catalog WHERE program_id=$1 AND account_id=$2 ORDER BY updated_at DESC",
        "SELECT * FROM program_artifact_catalog WHERE program_id=? AND account_id=? ORDER BY updated_at DESC",
        p,
      ),
      rows(
        "SELECT * FROM pine_exports WHERE program_id=$1 AND account_id=$2 ORDER BY created_at DESC",
        "SELECT * FROM pine_exports WHERE program_id=? AND account_id=? ORDER BY created_at DESC",
        p,
      ),
      rows(
        "SELECT * FROM pine_export_jobs WHERE program_id=$1 AND account_id=$2 ORDER BY created_at DESC",
        "SELECT * FROM pine_export_jobs WHERE program_id=? AND account_id=? ORDER BY created_at DESC",
        p,
      ),
      rows(
        "SELECT * FROM pine_imports WHERE program_id=$1 AND account_id=$2 ORDER BY created_at DESC",
        "SELECT * FROM pine_imports WHERE program_id=? AND account_id=? ORDER BY created_at DESC",
        p,
      ),
      rows(
        "SELECT * FROM pine_parity_results WHERE program_id=$1 AND account_id=$2 ORDER BY created_at DESC",
        "SELECT * FROM pine_parity_results WHERE program_id=? AND account_id=? ORDER BY created_at DESC",
        p,
      ),
      rows(
        "SELECT credential_id,pine_export_id,status,expires_at,created_at FROM tradingview_webhook_credentials WHERE program_id=$1 AND account_id=$2 ORDER BY created_at DESC",
        "SELECT credential_id,pine_export_id,status,expires_at,created_at FROM tradingview_webhook_credentials WHERE program_id=? AND account_id=? ORDER BY created_at DESC",
        p,
      ),
      rows(
        "SELECT * FROM tradingview_signal_observations WHERE program_id=$1 AND account_id=$2 ORDER BY received_at DESC LIMIT 200",
        "SELECT * FROM tradingview_signal_observations WHERE program_id=? AND account_id=? ORDER BY received_at DESC LIMIT 200",
        p,
      ),
    ]);
    return {
      qualifications: q.map(qualification),
      catalog: c.map(catalog),
      pine_exports: e.map(pineExport),
      pine_export_jobs: j.map((x) => ({
        pine_export_job_id: String(x.pine_export_job_id),
        pine_export_id: String(x.pine_export_id),
        account_id: String(x.account_id),
        program_id: String(x.program_id),
        spec_bundle_id: String(x.spec_bundle_id),
        status: String(x.status) as PineExportJobRecord["status"],
        progress_pct: Number(x.progress_pct),
        error_code: x.error_code ? String(x.error_code) : undefined,
        created_by_user_id: String(x.created_by_user_id),
        created_at: iso(x.created_at),
        started_at: x.started_at ? iso(x.started_at) : undefined,
        finished_at: x.finished_at ? iso(x.finished_at) : undefined,
      })),
      pine_imports: i.map((x) => ({ ...x, report: json(x.report_json, {}) })),
      parity_results: r.map((x) => ({ ...x, report: json(x.report_json, {}) })),
      alert_credentials: k.map((x) => ({
        credential_id: String(x.credential_id),
        pine_export_id: String(x.pine_export_id),
        status: String(x.status),
        expires_at: x.expires_at ? iso(x.expires_at) : undefined,
        created_at: iso(x.created_at),
      })),
      observations: o.map((x) => ({
        ...x,
        observation: json(x.observation_json, {}),
      })),
    };
  },
  async saveQualification(value: QualificationRecord) {
    const p = [
      value.qualification_id,
      value.program_id,
      value.account_id,
      value.spec_bundle_id,
      value.experiment_job_id ?? null,
      value.status,
      value.strategy_spec_hash,
      value.risk_policy_hash,
      value.config_hash,
      value.snapshot_hash,
      JSON.stringify(value.snapshot),
      value.created_by_user_id,
      value.created_at,
      value.approved_at ?? null,
      value.approved_by_user_id ?? null,
    ];
    if (getDatabaseProvider() === "postgres")
      await getPostgresPool().query(
        "INSERT INTO deployment_qualifications VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)",
        p,
      );
    else
      getDb()
        .prepare(
          "INSERT INTO deployment_qualifications VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .run(...p);
    return value;
  },
  async upsertCatalog(value: CatalogEntry) {
    const p = [
      value.catalog_id,
      value.account_id,
      value.program_id,
      value.artifact_type,
      value.object_id,
      value.sensitivity,
      value.content_hash,
      JSON.stringify(value.lineage),
      value.summary,
      value.searchable_text,
      JSON.stringify(value.anchors),
      JSON.stringify(value.schema),
      JSON.stringify(value.query_payload),
      JSON.stringify(value.units),
      value.storage_key ?? null,
      value.status,
      value.created_at,
      value.updated_at,
    ];
    if (getDatabaseProvider() === "postgres")
      await getPostgresPool().query(
        "INSERT INTO program_artifact_catalog VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) ON CONFLICT (program_id,artifact_type,object_id,content_hash) DO UPDATE SET summary=EXCLUDED.summary,searchable_text=EXCLUDED.searchable_text,query_payload_json=EXCLUDED.query_payload_json,updated_at=EXCLUDED.updated_at",
        p,
      );
    else
      getDb()
        .prepare(
          "INSERT INTO program_artifact_catalog VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(program_id,artifact_type,object_id,content_hash) DO UPDATE SET summary=excluded.summary,searchable_text=excluded.searchable_text,query_payload_json=excluded.query_payload_json,updated_at=excluded.updated_at",
        )
        .run(...p);
    return value;
  },
  async saveContext(value: {
    id: string;
    turnId: string;
    accountId: string;
    programId: string;
    query: unknown;
    result: unknown;
    catalogIds: string[];
    tokenEstimate: number;
    truncated: boolean;
    createdAt: string;
  }) {
    const p = [
      value.id,
      value.turnId,
      value.accountId,
      value.programId,
      JSON.stringify(value.query),
      JSON.stringify(value.result),
      JSON.stringify(value.catalogIds),
      value.tokenEstimate,
      value.truncated ? 1 : 0,
      "artifact_context_policy_v1",
      value.createdAt,
    ];
    if (getDatabaseProvider() === "postgres")
      await getPostgresPool().query(
        "INSERT INTO artifact_context_snapshots VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
        [...p.slice(0, 8), value.truncated, ...p.slice(9)],
      );
    else
      getDb()
        .prepare(
          "INSERT INTO artifact_context_snapshots VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        )
        .run(...p);
  },
  async savePineExport(value: PineExportRecord) {
    const p = [
      value.pine_export_id,
      value.account_id,
      value.program_id,
      value.spec_bundle_id,
      value.status,
      value.compatibility_status,
      value.parity_status,
      value.bundle_hash,
      value.storage_prefix,
      JSON.stringify(value.manifest),
      value.created_by_user_id,
      value.created_at,
      value.superseded_at ?? null,
    ];
    if (getDatabaseProvider() === "postgres")
      await getPostgresPool().query(
        "INSERT INTO pine_exports VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",
        p,
      );
    else
      getDb()
        .prepare("INSERT INTO pine_exports VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .run(...p);
    return value;
  },
  async supersedePineExports(
    programId: string,
    accountId: string,
    now: string,
  ) {
    if (getDatabaseProvider() === "postgres")
      await getPostgresPool().query(
        "UPDATE pine_exports SET status='superseded',superseded_at=$3 WHERE program_id=$1 AND account_id=$2 AND status='ready'",
        [programId, accountId, now],
      );
    else
      getDb()
        .prepare(
          "UPDATE pine_exports SET status='superseded',superseded_at=? WHERE program_id=? AND account_id=? AND status='ready'",
        )
        .run(now, programId, accountId);
  },
  async savePineExportJob(value: PineExportJobRecord) {
    const p = [
      value.pine_export_job_id,
      value.pine_export_id,
      value.account_id,
      value.program_id,
      value.spec_bundle_id,
      value.status,
      value.progress_pct,
      value.error_code ?? null,
      value.created_by_user_id,
      value.created_at,
      value.started_at ?? null,
      value.finished_at ?? null,
    ];
    if (getDatabaseProvider() === "postgres")
      await getPostgresPool().query(
        "INSERT INTO pine_export_jobs VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
        p,
      );
    else
      getDb()
        .prepare(
          "INSERT INTO pine_export_jobs VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .run(...p);
    return value;
  },
  async updatePineExportJob(
    jobId: string,
    accountId: string,
    patch: {
      status: PineExportJobRecord["status"];
      progress_pct: number;
      error_code?: string;
      started_at?: string;
      finished_at?: string;
    },
  ) {
    if (getDatabaseProvider() === "postgres")
      await getPostgresPool().query(
        "UPDATE pine_export_jobs SET status=$3,progress_pct=$4,error_code=$5,started_at=COALESCE(started_at,$6),finished_at=$7 WHERE pine_export_job_id=$1 AND account_id=$2",
        [
          jobId,
          accountId,
          patch.status,
          patch.progress_pct,
          patch.error_code ?? null,
          patch.started_at ?? null,
          patch.finished_at ?? null,
        ],
      );
    else
      getDb()
        .prepare(
          "UPDATE pine_export_jobs SET status=?,progress_pct=?,error_code=?,started_at=COALESCE(started_at,?),finished_at=? WHERE pine_export_job_id=? AND account_id=?",
        )
        .run(
          patch.status,
          patch.progress_pct,
          patch.error_code ?? null,
          patch.started_at ?? null,
          patch.finished_at ?? null,
          jobId,
          accountId,
        );
  },
  async saveImport(p: {
    id: string;
    accountId: string;
    programId: string;
    sourceHash: string;
    storageKey: string;
    report: unknown;
    status: string;
    userId: string;
    createdAt: string;
  }) {
    const x = [
      p.id,
      p.accountId,
      p.programId,
      p.sourceHash,
      p.storageKey,
      JSON.stringify(p.report),
      p.status,
      p.userId,
      p.createdAt,
    ];
    if (getDatabaseProvider() === "postgres")
      await getPostgresPool().query(
        "INSERT INTO pine_imports VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        x,
      );
    else
      getDb()
        .prepare("INSERT INTO pine_imports VALUES (?,?,?,?,?,?,?,?,?)")
        .run(...x);
  },
  async saveParity(p: {
    id: string;
    accountId: string;
    programId: string;
    exportId: string;
    report: Record<string, unknown>;
    userId: string;
    createdAt: string;
  }) {
    const x = [
      p.id,
      p.accountId,
      p.programId,
      p.exportId,
      JSON.stringify(p.report),
      p.report.verdict,
      p.report.report_hash,
      p.userId,
      p.createdAt,
    ];
    if (getDatabaseProvider() === "postgres")
      await getPostgresPool().query(
        "INSERT INTO pine_parity_results VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (report_hash) DO NOTHING",
        x,
      );
    else
      getDb()
        .prepare(
          "INSERT OR IGNORE INTO pine_parity_results VALUES (?,?,?,?,?,?,?,?,?)",
        )
        .run(...x);
  },
  async updatePineParity(exportId: string, accountId: string, status: string) {
    if (getDatabaseProvider() === "postgres")
      await getPostgresPool().query(
        "UPDATE pine_exports SET parity_status=$3 WHERE pine_export_id=$1 AND account_id=$2",
        [exportId, accountId, status],
      );
    else
      getDb()
        .prepare(
          "UPDATE pine_exports SET parity_status=? WHERE pine_export_id=? AND account_id=?",
        )
        .run(status, exportId, accountId);
  },
  async saveCredential(p: {
    id: string;
    accountId: string;
    programId: string;
    exportId: string;
    tokenHash: string;
    expiresAt?: string;
    userId: string;
    createdAt: string;
  }) {
    const x = [
      p.id,
      p.accountId,
      p.programId,
      p.exportId,
      p.tokenHash,
      "active",
      p.expiresAt ?? null,
      p.userId,
      p.createdAt,
      null,
    ];
    if (getDatabaseProvider() === "postgres")
      await getPostgresPool().query(
        "INSERT INTO tradingview_webhook_credentials VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
        x,
      );
    else
      getDb()
        .prepare(
          "INSERT INTO tradingview_webhook_credentials VALUES (?,?,?,?,?,?,?,?,?,?)",
        )
        .run(...x);
  },
  async revokeCredential(id: string, accountId: string, now: string) {
    if (getDatabaseProvider() === "postgres")
      await getPostgresPool().query(
        "UPDATE tradingview_webhook_credentials SET status='revoked',revoked_at=$3 WHERE credential_id=$1 AND account_id=$2 AND status='active'",
        [id, accountId, now],
      );
    else
      getDb()
        .prepare(
          "UPDATE tradingview_webhook_credentials SET status='revoked',revoked_at=? WHERE credential_id=? AND account_id=? AND status='active'",
        )
        .run(now, id, accountId);
  },
  async credentialByHash(hash: string) {
    const x = await rows(
      "SELECT * FROM tradingview_webhook_credentials WHERE token_hash=$1",
      "SELECT * FROM tradingview_webhook_credentials WHERE token_hash=?",
      [hash],
    );
    return x[0];
  },
  async saveObservation(p: {
    id: string;
    accountId: string;
    programId: string;
    exportId: string;
    idempotencyKey: string;
    payloadHash: string;
    observation: unknown;
    status: string;
    receivedAt: string;
  }) {
    const x = [
      p.id,
      p.accountId,
      p.programId,
      p.exportId,
      p.idempotencyKey,
      p.payloadHash,
      JSON.stringify(p.observation),
      p.status,
      p.receivedAt,
    ];
    if (getDatabaseProvider() === "postgres")
      await getPostgresPool().query(
        "INSERT INTO tradingview_signal_observations VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(idempotency_key) DO NOTHING",
        x,
      );
    else
      getDb()
        .prepare(
          "INSERT INTO tradingview_signal_observations VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(idempotency_key) DO NOTHING",
        )
        .run(...x);
  },
};
