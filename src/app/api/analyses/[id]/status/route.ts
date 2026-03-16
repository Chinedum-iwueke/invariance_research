import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/server/auth/session";
import { getAnalysisStatus, getOwnedAnalysis } from "@/lib/server/services/analysis-service";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const { id } = await params;
  const analysis = getOwnedAnalysis(id, session.account_id);
  if (!analysis) {
    return NextResponse.json({ error: { code: "not_found", message: "Analysis not found" } }, { status: 404 });
  }

  const status = getAnalysisStatus(id);
  if (!status) {
    return NextResponse.json({ error: { code: "not_found", message: "Analysis not found" } }, { status: 404 });
  }
  return NextResponse.json(status);
}
