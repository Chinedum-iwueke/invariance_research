import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/server/auth/session";
import { getReportSnapshotState, ensureReportSnapshotForAnalysis } from "@/lib/server/exports/report-snapshot-service";
import { getCoreRepositories } from "@/lib/server/persistence/repositories";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const { id } = await params;
  const analysis = await getCoreRepositories().analyses.findById(id);
  if (!analysis || analysis.account_id !== session.account_id) {
    return NextResponse.json({ error: { code: "not_found", message: "Analysis not found." } }, { status: 404 });
  }
  const state = await getReportSnapshotState(analysis);
  return NextResponse.json({
    active: state.active ? snapshotResponse(state.active) : undefined,
    stale: state.stale,
    warnings: state.warnings,
  });
}

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const { id } = await params;
  const analysis = await getCoreRepositories().analyses.findById(id);
  if (!analysis || analysis.account_id !== session.account_id) {
    return NextResponse.json({ error: { code: "not_found", message: "Analysis not found." } }, { status: 404 });
  }
  try {
    const snapshot = await ensureReportSnapshotForAnalysis(analysis);
    return NextResponse.json({ snapshot: snapshotResponse(snapshot) }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "snapshot_create_failed";
    const status = code === "analysis_not_completed" ? 422 : 400;
    return NextResponse.json({ error: { code, message: "Report snapshot could not be generated." } }, { status });
  }
}

function snapshotResponse(snapshot: Awaited<ReturnType<typeof ensureReportSnapshotForAnalysis>>) {
  return {
    snapshot_id: snapshot.snapshot_id,
    status: snapshot.status,
    report_schema_version: snapshot.payload.report_schema_version,
    generated_at: snapshot.payload.generated_at,
    warning_count: snapshot.warning_count,
    included_diagnostics: snapshot.payload.included_diagnostics,
    excluded_diagnostics: snapshot.payload.excluded_diagnostics,
    redaction_policy: snapshot.payload.redaction_policy,
  };
}
