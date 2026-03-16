import { randomUUID } from "node:crypto";
import { accountService } from "@/lib/server/accounts/service";
import { assertExportAllowed } from "@/lib/server/entitlements/policy";
import type { ExportFormat } from "@/lib/server/exports/models";
import { exportQueue } from "@/lib/server/queue/export-queue";
import { analysisRepository } from "@/lib/server/repositories/analysis-repository";
import { exportJobRepository } from "@/lib/server/repositories/export-job-repository";
import { exportRepository } from "@/lib/server/repositories/export-repository";
import { logger } from "@/lib/server/ops/logger";

const EXPORT_TTL_DAYS = 14;

export function requestExport(input: { analysis_id: string; account_id: string; user_id: string; format?: ExportFormat }) {
  const format = input.format ?? "json";
  const analysis = analysisRepository.findById(input.analysis_id);

  if (!analysis || analysis.account_id !== input.account_id) {
    throw new Error("analysis_not_found");
  }
  if (analysis.status !== "completed") {
    throw new Error("analysis_not_completed");
  }

  assertExportAllowed(input.account_id);

  const now = new Date();
  const exportId = randomUUID();
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + EXPORT_TTL_DAYS * 86_400_000).toISOString();

  exportRepository.save({
    export_id: exportId,
    analysis_id: analysis.analysis_id,
    account_id: input.account_id,
    requested_by_user_id: input.user_id,
    format,
    status: "queued",
    requested_at: createdAt,
    created_at: createdAt,
    updated_at: createdAt,
    expires_at: expiresAt,
  });

  exportJobRepository.save({
    export_job_id: randomUUID(),
    export_id: exportId,
    analysis_id: analysis.analysis_id,
    account_id: input.account_id,
    format,
    status: "queued",
    progress_pct: 0,
    current_step: "Queued",
    retry_count: 0,
    created_at: createdAt,
    available_at: createdAt,
  });

  accountService.incrementUsage(input.account_id, "export");
  exportQueue.enqueueRun(exportId);
  logger.info("export.requested", { export_id: exportId, analysis_id: analysis.analysis_id, account_id: input.account_id, format });

  return { export_id: exportId, status: "queued", format, expires_at: expiresAt };
}

export function getExportOwned(exportId: string, accountId: string) {
  const record = exportRepository.findById(exportId);
  if (!record || record.account_id !== accountId) return undefined;
  return record;
}

export function listExportsForAnalysis(analysisId: string, accountId: string) {
  const analysis = analysisRepository.findById(analysisId);
  if (!analysis || analysis.account_id !== accountId) throw new Error("analysis_not_found");
  return exportRepository.listByAnalysis(analysisId);
}
