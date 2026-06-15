import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/server/auth/session";
import { enforceRateLimit } from "@/lib/server/rate-limits";
import { requestProgramResearchDeskReview } from "@/lib/server/research-programs/program-report-service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string; reportId: string }> }) {
  const session = await requireServerSession();
  const limited = await enforceRateLimit({ request, route: "program_research_desk_request", kind: "research_desk", userId: session.user_id, accountId: session.account_id });
  if (limited) return limited;
  const { reportId } = await params;
  const body = await request.json().catch(() => ({})) as { user_note?: string };
  try {
    const result = await requestProgramResearchDeskReview({
      program_report_snapshot_id: reportId,
      account_id: session.account_id,
      requested_by_user_id: session.user_id,
      user_note: typeof body.user_note === "string" ? body.user_note : undefined,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "program_research_desk_request_failed";
    const status = code === "research_desk_plan_restricted" ? 403 : code === "program_report_not_found" ? 404 : code === "program_report_requires_audit_import" ? 409 : 400;
    return NextResponse.json({ error: { code, message: "Research Desk request could not be created." } }, { status });
  }
}
