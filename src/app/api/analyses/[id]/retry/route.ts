import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/server/auth/session";
import { analysisRepository } from "@/lib/server/repositories/analysis-repository";
import { retryAnalysis } from "@/lib/server/services/analysis-service";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const { id } = await params;
  const analysis = analysisRepository.findById(id);
  if (!analysis || analysis.account_id !== session.account_id) {
    return NextResponse.json({ error: { code: "not_found", message: "Analysis not found" } }, { status: 404 });
  }

  const status = retryAnalysis(id);
  if (!status) {
    return NextResponse.json(
      { error: { code: "retry_not_allowed", message: "Retry is only available for failed analyses." } },
      { status: 422 },
    );
  }
  return NextResponse.json(status);
}
