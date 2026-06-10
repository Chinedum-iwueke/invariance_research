import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/server/auth/session";
import { getExportOwned } from "@/lib/server/exports/export-service";
import { exportJobRepository } from "@/lib/server/repositories/export-job-repository";

function exportApiError(error: unknown) {
  const candidate = error as { code?: string; message?: string };
  if (candidate?.code === "XX000" && /max clients reached/i.test(candidate.message ?? "")) {
    return NextResponse.json(
      { error: { code: "database_pool_saturated", message: "Database connection pool is saturated. Please retry in a moment." } },
      { status: 503 },
    );
  }
  if (/SQLite getDb\(\) was called while DATABASE_PROVIDER=postgres/i.test(candidate?.message ?? "")) {
    return NextResponse.json(
      { error: { code: "provider_contract_violation", message: "A server repository used the SQLite path while production is configured for Postgres." } },
      { status: 500 },
    );
  }
  return NextResponse.json(
    { error: { code: "export_status_failed", message: candidate?.message ?? "Export status unavailable." } },
    { status: 500 },
  );
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireServerSession();
    const { id } = await params;
    const record = await getExportOwned(id, session.account_id);
    if (!record) {
      return NextResponse.json({ error: { code: "not_found", message: "Export not found" } }, { status: 404 });
    }
    const job = await exportJobRepository.findByExportId(id);
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
  } catch (error) {
    return exportApiError(error);
  }
}
