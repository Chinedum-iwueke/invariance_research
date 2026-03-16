import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/server/admin/guards";
import { runAdminMaintenanceAction } from "@/lib/server/admin/maintenance-service";

export async function POST(_: Request, { params }: { params: Promise<{ action: string }> }) {
  await requireAdminSession();
  const { action } = await params;
  if (!["sweep", "expired_exports", "stale_failed_jobs"].includes(action)) {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  const result = runAdminMaintenanceAction(action as "sweep" | "expired_exports" | "stale_failed_jobs");
  return NextResponse.json({ ok: true, result });
}
