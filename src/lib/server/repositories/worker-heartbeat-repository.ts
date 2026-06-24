import { getDatabaseProvider } from "@/lib/server/persistence/provider";
import { postgresWorkerHeartbeatRepository } from "@/lib/server/repositories/postgres-worker-heartbeat-repository";
import { sqliteWorkerHeartbeatRepository } from "@/lib/server/repositories/sqlite-worker-heartbeat-repository";

export type WorkerHeartbeat = {
  worker_type: "analysis" | "export" | "experiment" | "execution";
  instance_id: string;
  status: "idle" | "processing";
  last_seen_at: string;
  last_job_id?: string;
  last_job_status?: "completed" | "failed";
  updated_at: string;
};

export type WorkerHeartbeatRepository = {
  upsert(heartbeat: WorkerHeartbeat): void | Promise<void>;
  list(workerType?: WorkerHeartbeat["worker_type"]): WorkerHeartbeat[] | Promise<WorkerHeartbeat[]>;
};

export const workerHeartbeatRepository: WorkerHeartbeatRepository = {
  upsert(heartbeat: WorkerHeartbeat) {
    return getDatabaseProvider() === "postgres"
      ? postgresWorkerHeartbeatRepository.upsert(heartbeat)
      : sqliteWorkerHeartbeatRepository.upsert(heartbeat);
  },
  list(workerType) {
    return getDatabaseProvider() === "postgres"
      ? postgresWorkerHeartbeatRepository.list(workerType)
      : sqliteWorkerHeartbeatRepository.list(workerType);
  },
};
