import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/server/auth/session";
import { createResearchDeskRequest } from "@/lib/server/research-desk/research-desk-service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const { id } = await params;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;

  try {
    const result = await createResearchDeskRequest({
      analysis_id: id,
      account_id: session.account_id,
      requested_by_user_id: session.user_id,
      trigger_limitation: typeof body.trigger_limitation === "string" ? body.trigger_limitation : undefined,
      requested_services: Array.isArray(body.requested_services) ? body.requested_services.filter((value): value is string => typeof value === "string") : undefined,
      user_note: typeof body.user_note === "string" ? body.user_note : undefined,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "research_desk_request_failed";
    const status = code === "analysis_not_found" ? 404 : code === "analysis_not_report_ready" ? 409 : 400;
    return NextResponse.json({ error: code }, { status });
  }
}
