import { NextResponse } from "next/server";
import { runMaintenanceSweep } from "@/lib/server/maintenance/retention-service";

export async function POST() {
  const result = runMaintenanceSweep();
  return NextResponse.json({ ok: true, ...result });
}
