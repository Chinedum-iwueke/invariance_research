import { NextResponse } from "next/server";
import { isAdminIdentity } from "@/lib/server/admin/guards";
import { requireServerSession } from "@/lib/server/auth/session";
import { listExportsForAnalysis, requestExport } from "@/lib/server/exports/export-service";
import { enforceRateLimit } from "@/lib/server/rate-limits";
import { assertQueueAccepting, isOperationalPauseError } from "@/lib/server/ops/operations-policy";

function exportRouteError(error: unknown, fallbackCode = "export_request_failed") {
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
  const code = candidate?.message ?? fallbackCode;
  const status = isOperationalPauseError(code) ? 503 : code === "report_export_plan_restricted" ? 403 : code === "analysis_not_completed" ? 422 : 404;
  return NextResponse.json({ error: { code, message: "Export request rejected." } }, { status });
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireServerSession();
    const { id } = await params;
    const items = await listExportsForAnalysis(id, session.account_id);
    return NextResponse.json({ items });
  } catch (error) {
    return exportRouteError(error, "not_found");
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireServerSession();
    const limited = await enforceRateLimit({ request, route: "export_request", kind: "export", userId: session.user_id, accountId: session.account_id });
    if (limited) return limited;
    assertQueueAccepting("export");
    const isAdmin = await isAdminIdentity({ user_id: session.user_id, email: session.email });
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { format?: "json" | "md" | "pdf" };
    const created = await requestExport({ analysis_id: id, account_id: session.account_id, user_id: session.user_id, format: body.format, is_admin: isAdmin });
    return NextResponse.json(created, { status: 202 });
  } catch (error) {
    return exportRouteError(error);
  }
}
