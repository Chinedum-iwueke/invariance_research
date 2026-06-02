import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/server/admin/guards";
import { writeAdminAuditLog } from "@/lib/server/admin/audit-log";
import { assertSameOrigin } from "@/lib/server/auth/security";
import { isValidWaitlistStatus, updateWaitlistEntry } from "@/lib/server/waitlist/repository";
import type { WaitlistStatus } from "@/lib/server/waitlist/repository";

const waitlistUpdateSchema = z.object({
  status: z.string().optional(),
  note: z.string().max(1000).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  assertSameOrigin(request);
  const actor = await requireAdminSession();
  const { id } = await params;

  const json = await request.json().catch(() => null);
  const parsed = waitlistUpdateSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const rawStatus = parsed.data.status;
  let status: WaitlistStatus | undefined;
  if (rawStatus !== undefined) {
    if (!isValidWaitlistStatus(rawStatus)) {
      return NextResponse.json({ error: "invalid_status" }, { status: 400 });
    }
    status = rawStatus;
  }

  const ok = await updateWaitlistEntry({
    waitlistEntryId: id,
    status,
    note: parsed.data.note,
  });

  if (!ok) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  revalidatePath("/app/admin/waitlist");
  await writeAdminAuditLog({
    actor,
    action: "waitlist.update",
    resourceType: "waitlist_entry",
    resourceId: id,
    metadata: { status, note_updated: parsed.data.note !== undefined },
    request,
  });
  return NextResponse.json({ ok: true });
}
