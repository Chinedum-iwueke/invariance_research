import { NextResponse } from "next/server";
import { retryAnalysis } from "@/lib/server/services/analysis-service";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const status = retryAnalysis(id);
  if (!status) {
    return NextResponse.json({ error: { code: "retry_not_allowed", message: "Retry is only available for failed analyses." } }, { status: 422 });
  }
  return NextResponse.json(status);
}
