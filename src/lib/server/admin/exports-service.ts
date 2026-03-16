import { cleanupExpiredExports } from "@/lib/server/maintenance/retention-service";
import { exportQueue } from "@/lib/server/queue/export-queue";
import { getDb } from "@/lib/server/persistence/database";
import { exportRepository } from "@/lib/server/repositories/export-repository";
import { exportJobRepository } from "@/lib/server/repositories/export-job-repository";

export type AdminExportView = {
  export_id: string;
  analysis_id: string;
  account_id: string;
  owner_email?: string;
  status: string;
  content_type?: string;
  storage_key?: string;
  file_size_bytes?: number;
  checksum_sha256?: string;
  created_at: string;
  expires_at?: string;
  error_summary?: string;
};

export function listAdminExports(filter?: "failed" | "expired" | "recent") {
  const rows = getDb()
    .prepare(
      `SELECT e.*, u.email as owner_email
       FROM exports e
       JOIN accounts a ON a.account_id = e.account_id
       JOIN users u ON u.user_id = a.owner_user_id
       ORDER BY e.created_at DESC`,
    )
    .all() as Record<string, unknown>[];

  const mapped: AdminExportView[] = rows.map((row) => ({
    export_id: String(row.export_id),
    analysis_id: String(row.analysis_id),
    account_id: String(row.account_id),
    owner_email: row.owner_email ? String(row.owner_email) : undefined,
    status: String(row.status),
    content_type: row.content_type ? String(row.content_type) : undefined,
    storage_key: row.storage_key ? String(row.storage_key) : undefined,
    file_size_bytes: row.file_size_bytes === null ? undefined : Number(row.file_size_bytes),
    checksum_sha256: row.checksum_sha256 ? String(row.checksum_sha256) : undefined,
    created_at: String(row.created_at),
    expires_at: row.expires_at ? String(row.expires_at) : undefined,
    error_summary: row.error_message ? String(row.error_message) : undefined,
  }));

  const filtered = mapped.filter((item) => {
    if (filter === "failed") return item.status === "failed";
    if (filter === "expired") return Boolean(item.expires_at && Date.parse(item.expires_at) <= Date.now());
    if (filter === "recent") return Date.now() - Date.parse(item.created_at) < 86_400_000;
    return true;
  });

  return {
    rows: filtered,
    summary: {
      total: mapped.length,
      failed: mapped.filter((item) => item.status === "failed").length,
      expired: mapped.filter((item) => Boolean(item.expires_at && Date.parse(item.expires_at) <= Date.now())).length,
      completed: mapped.filter((item) => item.status === "completed").length,
    },
  };
}

export function retryAdminExport(exportId: string) {
  const job = exportJobRepository.findByExportId(exportId);
  const record = exportRepository.findById(exportId);
  if (!job || !record || record.status !== "failed") throw new Error("retry_not_allowed");
  exportRepository.update(exportId, (current) => ({
    ...current,
    status: "queued",
    error_code: undefined,
    error_message: undefined,
    updated_at: new Date().toISOString(),
  }));
  exportQueue.enqueueRetry(exportId, job.retry_count + 1);
  return { ok: true, export_id: exportId };
}

export function cleanupAdminExpiredExports() {
  return cleanupExpiredExports();
}
