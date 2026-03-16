import { renderExport } from "@/lib/server/exports/export-renderer";
import { logger } from "@/lib/server/ops/logger";
import { exportJobRepository } from "@/lib/server/repositories/export-job-repository";
import { exportRepository } from "@/lib/server/repositories/export-repository";
import { analysisRepository } from "@/lib/server/repositories/analysis-repository";
import { getObjectStorage } from "@/lib/server/storage/object-storage";

let active = false;

export function startExportWorker() {
  if (active) return;
  active = true;
  queueMicrotask(async () => {
    try {
      while (await processNextExportJob()) {
        // drain
      }
    } finally {
      active = false;
    }
  });
}

export async function processNextExportJob(): Promise<boolean> {
  const claimed = exportJobRepository.claimNextQueued(new Date().toISOString());
  if (!claimed) return false;

  const exportRecord = exportRepository.findById(claimed.export_id);
  if (!exportRecord) return false;
  exportRepository.update(exportRecord.export_id, (current) => ({ ...current, status: "processing", updated_at: new Date().toISOString() }));

  try {
    exportJobRepository.updateByExportId(claimed.export_id, (current) => ({ ...current, current_step: "Rendering report", progress_pct: 60 }));
    const analysis = analysisRepository.findById(exportRecord.analysis_id);
    if (!analysis?.result) throw new Error("analysis_result_missing");

    const rendered = renderExport(analysis.result, exportRecord.format);
    exportJobRepository.updateByExportId(claimed.export_id, (current) => ({ ...current, current_step: "Persisting export", progress_pct: 85 }));

    const stored = getObjectStorage().putObject({
      bucket: "exports",
      file_name: rendered.file_name,
      content_type: rendered.content_type,
      bytes: rendered.bytes,
    });

    exportRepository.update(claimed.export_id, (current) => ({
      ...current,
      status: "completed",
      storage_key: stored.storage_key,
      content_type: stored.content_type,
      file_size_bytes: stored.size_bytes,
      checksum_sha256: stored.checksum_sha256,
      error_code: undefined,
      error_message: undefined,
      updated_at: new Date().toISOString(),
    }));

    exportJobRepository.updateByExportId(claimed.export_id, (current) => ({
      ...current,
      status: "completed",
      current_step: "Completed",
      progress_pct: 100,
      finished_at: new Date().toISOString(),
      error_code: undefined,
      error_message: undefined,
    }));

    logger.info("export.completed", { export_id: claimed.export_id, analysis_id: claimed.analysis_id, account_id: claimed.account_id });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "export_failed";
    exportRepository.update(claimed.export_id, (current) => ({
      ...current,
      status: "failed",
      error_code: "export_generation_failed",
      error_message: message,
      updated_at: new Date().toISOString(),
    }));
    exportJobRepository.updateByExportId(claimed.export_id, (current) => ({
      ...current,
      status: "failed",
      error_code: "export_generation_failed",
      error_message: message,
      current_step: "Failed",
      finished_at: new Date().toISOString(),
    }));
    logger.error("export.failed", { export_id: claimed.export_id, error: message });
    return true;
  }
}
