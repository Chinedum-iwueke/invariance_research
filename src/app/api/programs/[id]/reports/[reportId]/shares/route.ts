import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/server/auth/session";
import { enforceRateLimit } from "@/lib/server/rate-limits";
import { createProgramReportShare } from "@/lib/server/research-programs/program-report-service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string; reportId: string }> }) {
  const session = await requireServerSession();
  const limited = await enforceRateLimit({ request, route: "program_report_share", kind: "share_create", userId: session.user_id, accountId: session.account_id });
  if (limited) return limited;
  const { reportId } = await params;
  const body = await request.json().catch(() => ({})) as { expires_at?: string };
  try {
    const created = await createProgramReportShare({
      program_report_snapshot_id: reportId,
      account_id: session.account_id,
      user_id: session.user_id,
      expires_at: body.expires_at,
    });
    return NextResponse.json({ share_id: created.share.share_id, token: created.token, url: created.url, expires_at: created.share.expires_at }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "program_report_share_failed";
    const status = code === "share_plan_restricted" ? 403 : code === "program_report_not_found" ? 404 : 400;
    return NextResponse.json({ error: { code, message: "Program report share could not be created." } }, { status });
  }
}
