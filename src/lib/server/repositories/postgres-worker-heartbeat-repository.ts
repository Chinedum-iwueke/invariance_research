import { getPostgresPool } from "@/lib/server/persistence/postgres";
import type { WorkerHeartbeat, WorkerHeartbeatRepository } from "@/lib/server/repositories/worker-heartbeat-repository";

let schemaReady: Promise<void> | undefined;

function ensureHeartbeatSchema() {
  schemaReady ??= getPostgresPool()
    .query(
      `CREATE TABLE IF NOT EXISTS worker_heartbeats (
        worker_type TEXT NOT NULL,
        instance_id TEXT NOT NULL,
        status TEXT NOT NULL,
        last_seen_at TIMESTAMPTZ NOT NULL,
        last_job_id TEXT,
        last_job_status TEXT,
        updated_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (worker_type, instance_id)
      )`,
    )
    .then(() => undefined);
  return schemaReady;
}

function iso(value: unknown) {
  return value instanceof Date ? value.toISOString() : String(value);
}

function mapRow(row: Record<string, unknown>): WorkerHeartbeat {
  return {
    worker_type: row.worker_type as WorkerHeartbeat["worker_type"],
    instance_id: String(row.instance_id),
    status: row.status as WorkerHeartbeat["status"],
    last_seen_at: iso(row.last_seen_at),
    last_job_id: row.last_job_id ? String(row.last_job_id) : undefined,
    last_job_status: row.last_job_status ? (row.last_job_status as WorkerHeartbeat["last_job_status"]) : undefined,
    updated_at: iso(row.updated_at),
  };
}

export const postgresWorkerHeartbeatRepository: WorkerHeartbeatRepository = {
  async upsert(heartbeat) {
    await ensureHeartbeatSchema();
    await getPostgresPool().query(
      `INSERT INTO worker_heartbeats (worker_type, instance_id, status, last_seen_at, last_job_id, last_job_status, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT(worker_type, instance_id)
       DO UPDATE SET status = EXCLUDED.status,
                     last_seen_at = EXCLUDED.last_seen_at,
                     last_job_id = EXCLUDED.last_job_id,
                     last_job_status = EXCLUDED.last_job_status,
                     updated_at = EXCLUDED.updated_at`,
      [
        heartbeat.worker_type,
        heartbeat.instance_id,
        heartbeat.status,
        heartbeat.last_seen_at,
        heartbeat.last_job_id ?? null,
        heartbeat.last_job_status ?? null,
        heartbeat.updated_at,
      ],
    );
  },
  async list(workerType) {
    await ensureHeartbeatSchema();
    const result = workerType
      ? await getPostgresPool().query("SELECT * FROM worker_heartbeats WHERE worker_type = $1 ORDER BY last_seen_at DESC", [workerType])
      : await getPostgresPool().query("SELECT * FROM worker_heartbeats ORDER BY last_seen_at DESC");
    return result.rows.map(mapRow);
  },
};
