import { NextResponse } from "next/server";
import { getWebReadinessSnapshot } from "@/lib/server/ops/web-health-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getWebReadinessSnapshot();
  return NextResponse.json(snapshot, {
    status: snapshot.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
