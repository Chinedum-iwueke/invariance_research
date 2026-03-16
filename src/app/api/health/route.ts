import { NextResponse } from "next/server";
import { getHealthSnapshot } from "@/lib/server/ops/health-service";

export async function GET() {
  const snapshot = await getHealthSnapshot();
  const code = snapshot.status === "healthy" ? 200 : snapshot.status === "degraded" ? 200 : 503;
  return NextResponse.json(snapshot, { status: code });
}
