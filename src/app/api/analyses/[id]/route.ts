import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/server/auth/session";
import { analysisRepository } from "@/lib/server/repositories/analysis-repository";
import { getAnalysisDetail } from "@/lib/server/services/analysis-service";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const { id } = await params;
  const analysis = analysisRepository.findById(id);
  if (!analysis || analysis.account_id !== session.account_id) {
    return NextResponse.json({ error: { code: "not_found", message: "Analysis not found" } }, { status: 404 });
  }

  const detail = getAnalysisDetail(id);
  if (!detail) {
    return NextResponse.json({ error: { code: "not_found", message: "Analysis not found" } }, { status: 404 });
  }
  return NextResponse.json(detail);
}
