import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/server/admin/guards";
import { runAdminMaintenanceAction } from "@/lib/server/admin/maintenance-service";

export async function POST(_: Request, { params }: { params: Promise<{ action: string }> }) {
  await requireAdminSession();
  const { action } = await params;
  const actions = ["sweep", "expired_exports", "stale_failed_jobs", "stale_processing_jobs", "share_access_events", "benchmark_library_refresh"] as const;
  if (!actions.includes(action as (typeof actions)[number])) {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  const result = await runAdminMaintenanceAction(action as (typeof actions)[number]);
  return NextResponse.json({ ok: true, result });
}
