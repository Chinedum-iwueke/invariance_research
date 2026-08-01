import { NextResponse } from "next/server";
import { getLivenessSnapshot } from "@/lib/server/ops/web-health-service";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(getLivenessSnapshot(), {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
