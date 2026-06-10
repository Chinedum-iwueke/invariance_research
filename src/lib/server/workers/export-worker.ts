import { renderExportFromSnapshot } from "@/lib/server/exports/export-renderer";
import { logger } from "@/lib/server/ops/logger";
import { exportJobRepository } from "@/lib/server/repositories/export-job-repository";
import { exportRepository } from "@/lib/server/repositories/export-repository";
import { getCoreRepositories } from "@/lib/server/persistence/repositories";
import { reportSnapshotRepository } from "@/lib/server/repositories/report-snapshot-repository";
import { ensureReportSnapshotForAnalysis } from "@/lib/server/exports/report-snapshot-service";
import { getObjectStorage } from "@/lib/server/storage/object-storage";
import { buildReportObjectKey } from "@/lib/server/storage/object-keys";
import { runWorkerLoop } from "@/lib/server/workers/worker-runtime";
import { assertWorkerRuntimeConfig } from "@/lib/server/queue/runtime-config";
import { recordEvidenceEvent } from "@/lib/server/evidence/evidence-events";

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

export async function runExportWorkerRuntime() {
  const config = assertWorkerRuntimeConfig();
  if (config.mode !== "external") {
    throw new Error("Export worker runtime requires WORKER_MODE=external.");
  }
  await runWorkerLoop({ workerType: "export", processNext: processNextExportJob });
}

export async function processNextExportJob(): Promise<boolean> {
  const claimed = await exportJobRepository.claimNextQueued(new Date().toISOString());
  if (!claimed) return false;

  const exportRecord = await exportRepository.findById(claimed.export_id);
  if (!exportRecord) return false;
  await exportRepository.update(exportRecord.export_id, (current) => ({ ...current, status: "processing", updated_at: new Date().toISOString() }));

  try {
    await exportJobRepository.updateByExportId(claimed.export_id, (current) => ({ ...current, current_step: "Rendering report", progress_pct: 60 }));
    const analysis = await getCoreRepositories().analyses.findById(exportRecord.analysis_id);
    if (!analysis?.result) throw new Error("analysis_result_missing");
    const snapshot = exportRecord.report_snapshot_id
      ? await reportSnapshotRepository.findById(exportRecord.report_snapshot_id)
      : await ensureReportSnapshotForAnalysis(analysis);
    if (!snapshot) throw new Error("report_snapshot_missing");

    const rendered = renderExportFromSnapshot(snapshot, exportRecord.format);
    await exportJobRepository.updateByExportId(claimed.export_id, (current) => ({ ...current, current_step: "Persisting export", progress_pct: 85 }));

    const stored = await getObjectStorage().putObject({
      bucket: "reports",
      file_name: rendered.file_name,
      content_type: rendered.content_type,
      bytes: rendered.bytes,
      storage_key: buildReportObjectKey({
        accountId: exportRecord.account_id,
        analysisId: exportRecord.analysis_id,
        fileName: rendered.file_name,
      }),
    });

    await exportRepository.update(claimed.export_id, (current) => ({
      ...current,
      status: "completed",
      report_snapshot_id: snapshot.snapshot_id,
      storage_key: stored.storage_key,
      content_type: stored.content_type,
      file_size_bytes: stored.size_bytes,
      checksum_sha256: stored.checksum_sha256,
      error_code: undefined,
      error_message: undefined,
      updated_at: new Date().toISOString(),
    }));

    await exportJobRepository.updateByExportId(claimed.export_id, (current) => ({
      ...current,
      status: "completed",
      current_step: "Completed",
      progress_pct: 100,
      finished_at: new Date().toISOString(),
      error_code: undefined,
      error_message: undefined,
    }));

    logger.info("export.completed", { export_id: claimed.export_id, analysis_id: claimed.analysis_id, account_id: claimed.account_id, report_snapshot_id: snapshot.snapshot_id });
    await recordEvidenceEvent({
      analysis_id: claimed.analysis_id,
      account_id: claimed.account_id,
      artifact_id: analysis.artifact_id,
      report_snapshot_id: snapshot.snapshot_id,
      export_id: claimed.export_id,
      event_type: "export_completed",
      severity: "info",
      title: "Report export completed",
      summary: `${exportRecord.format.toUpperCase()} validation memo export is available to the owner account.`,
      payload: {
        format: exportRecord.format,
        storage_key: stored.storage_key,
        checksum_sha256: stored.checksum_sha256,
        file_size_bytes: stored.size_bytes,
      },
    });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "export_failed";
    await exportRepository.update(claimed.export_id, (current) => ({
      ...current,
      status: "failed",
      error_code: "export_generation_failed",
      error_message: message,
      updated_at: new Date().toISOString(),
    }));
    await exportJobRepository.updateByExportId(claimed.export_id, (current) => ({
      ...current,
      status: "failed",
      error_code: "export_generation_failed",
      error_message: message,
      current_step: "Failed",
      finished_at: new Date().toISOString(),
    }));
    logger.error("export.failed", { export_id: claimed.export_id, error: message });
    await recordEvidenceEvent({
      analysis_id: claimed.analysis_id,
      account_id: claimed.account_id,
      export_id: claimed.export_id,
      event_type: "export_failed",
      severity: "warning",
      title: "Report export failed",
      summary: message,
      payload: { error_code: "export_generation_failed" },
    });
    return true;
  }
}
