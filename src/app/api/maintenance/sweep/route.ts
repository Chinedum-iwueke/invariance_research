import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/server/admin/guards";
import { runMaintenanceSweep } from "@/lib/server/maintenance/retention-service";

export async function POST() {
  await requireAdminSession();
  const result = runMaintenanceSweep();
  return NextResponse.json({ ok: true, ...result });
}
