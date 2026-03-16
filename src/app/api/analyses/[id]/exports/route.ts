import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/server/auth/session";
import { listExportsForAnalysis, requestExport } from "@/lib/server/exports/export-service";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const { id } = await params;
  try {
    const items = listExportsForAnalysis(id, session.account_id);
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ error: { code: "not_found", message: "Analysis not found" } }, { status: 404 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { format?: "json" | "md" | "pdf" };

  try {
    const created = requestExport({ analysis_id: id, account_id: session.account_id, user_id: session.user_id, format: body.format });
    return NextResponse.json(created, { status: 202 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "export_request_failed";
    const status = code === "report_export_plan_restricted" ? 403 : code === "analysis_not_completed" ? 422 : 404;
    return NextResponse.json({ error: { code, message: "Export request rejected." } }, { status });
  }
}
