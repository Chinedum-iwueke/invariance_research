import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/server/admin/guards";
import { isValidWaitlistStatus, updateWaitlistEntry } from "@/lib/server/waitlist/repository";
import type { WaitlistStatus } from "@/lib/server/waitlist/repository";

const waitlistUpdateSchema = z.object({
  status: z.string().optional(),
  note: z.string().max(1000).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdminSession();
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

  const ok = updateWaitlistEntry({
    waitlistEntryId: id,
    status,
    note: parsed.data.note,
  });

  if (!ok) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  revalidatePath("/app/admin/waitlist");
  return NextResponse.json({ ok: true });
}
