import { NextResponse } from "next/server";
import { getAnalysisStatus } from "@/lib/server/services/analysis-service";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const status = getAnalysisStatus(id);
  if (!status) {
    return NextResponse.json({ error: { code: "not_found", message: "Analysis not found" } }, { status: 404 });
  }
  return NextResponse.json(status);
}
