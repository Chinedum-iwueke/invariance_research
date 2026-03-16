import { getDb } from "@/lib/server/persistence/database";

export type WorkerHeartbeat = {
  worker_type: "analysis" | "export";
  instance_id: string;
  status: "idle" | "processing";
  last_seen_at: string;
  last_job_id?: string;
  last_job_status?: "completed" | "failed";
  updated_at: string;
};

function mapRow(row: Record<string, unknown>): WorkerHeartbeat {
  return {
    worker_type: row.worker_type as WorkerHeartbeat["worker_type"],
    instance_id: String(row.instance_id),
    status: row.status as WorkerHeartbeat["status"],
    last_seen_at: String(row.last_seen_at),
    last_job_id: row.last_job_id ? String(row.last_job_id) : undefined,
    last_job_status: row.last_job_status ? (row.last_job_status as WorkerHeartbeat["last_job_status"]) : undefined,
    updated_at: String(row.updated_at),
  };
}

export const workerHeartbeatRepository = {
  upsert(heartbeat: WorkerHeartbeat) {
    getDb()
      .prepare(
        `INSERT INTO worker_heartbeats (worker_type, instance_id, status, last_seen_at, last_job_id, last_job_status, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(worker_type, instance_id)
         DO UPDATE SET status = excluded.status, last_seen_at = excluded.last_seen_at, last_job_id = excluded.last_job_id, last_job_status = excluded.last_job_status, updated_at = excluded.updated_at`,
      )
      .run(
        heartbeat.worker_type,
        heartbeat.instance_id,
        heartbeat.status,
        heartbeat.last_seen_at,
        heartbeat.last_job_id ?? null,
        heartbeat.last_job_status ?? null,
        heartbeat.updated_at,
      );
  },
  list(workerType?: WorkerHeartbeat["worker_type"]) {
    const rows = workerType
      ? (getDb().prepare("SELECT * FROM worker_heartbeats WHERE worker_type = ? ORDER BY last_seen_at DESC").all(workerType) as Record<string, unknown>[])
      : (getDb().prepare("SELECT * FROM worker_heartbeats ORDER BY last_seen_at DESC").all() as Record<string, unknown>[]);
    return rows.map(mapRow);
  },
};
