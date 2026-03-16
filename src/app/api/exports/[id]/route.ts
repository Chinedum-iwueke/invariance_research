import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/server/auth/session";
import { getExportOwned } from "@/lib/server/exports/export-service";
import { exportJobRepository } from "@/lib/server/repositories/export-job-repository";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const { id } = await params;
  const record = getExportOwned(id, session.account_id);
  if (!record) {
    return NextResponse.json({ error: { code: "not_found", message: "Export not found" } }, { status: 404 });
  }
  const job = exportJobRepository.findByExportId(id);
  return NextResponse.json({
    export_id: record.export_id,
    analysis_id: record.analysis_id,
    format: record.format,
    status: record.status,
    error: record.error_message ? { code: record.error_code ?? "export_failed", message: record.error_message } : undefined,
    progress_pct: job?.progress_pct,
    current_step: job?.current_step,
    expires_at: record.expires_at,
    download_url: record.status === "completed" ? `/api/exports/${record.export_id}/download` : undefined,
  });
}
