import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/server/auth/session";
import { enforceRateLimit } from "@/lib/server/rate-limits";
import { createProgramReportSnapshot } from "@/lib/server/research-programs/program-report-service";
import { getResearchProgramDetail } from "@/lib/server/research-programs/service";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const { id } = await params;
  const detail = await getResearchProgramDetail(id, session.account_id);
  if (!detail) return NextResponse.json({ error: "program_not_found" }, { status: 404 });
  return NextResponse.json({ items: detail.reports });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const limited = await enforceRateLimit({ request, route: "program_report_create", kind: "export", userId: session.user_id, accountId: session.account_id });
  if (limited) return limited;
  const { id } = await params;
  try {
    const report = await createProgramReportSnapshot({ program_id: id, account_id: session.account_id, user_id: session.user_id });
    return NextResponse.json({ report }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "program_report_create_failed";
    const status = code === "program_not_found" ? 404 : code === "program_report_not_ready" ? 409 : 400;
    return NextResponse.json({ error: { code, message: "Program report could not be generated." } }, { status });
  }
}
