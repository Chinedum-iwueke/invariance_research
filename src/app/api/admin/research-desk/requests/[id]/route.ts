import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/server/admin/guards";
import { updateResearchDeskRequest } from "@/lib/server/research-desk/research-desk-service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminSession();
  const { id } = await params;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;

  try {
    const result = updateResearchDeskRequest({
      request_id: id,
      reviewer_user_id: admin.user_id,
      status: typeof body.status === "string" ? body.status : undefined,
      addendum_status: typeof body.addendum_status === "string" ? body.addendum_status : undefined,
      internal_note: typeof body.internal_note === "string" ? body.internal_note : undefined,
      public_addendum: typeof body.public_addendum === "string" ? body.public_addendum : undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : "research_desk_update_failed";
    return NextResponse.json({ error: code }, { status: code === "research_desk_request_not_found" ? 404 : 400 });
  }
}
