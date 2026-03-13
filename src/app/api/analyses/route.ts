import { NextResponse } from "next/server";
import { createAnalysisFromArtifact, listAnalyses } from "@/lib/server/services/analysis-service";

export async function GET() {
  return NextResponse.json({ items: listAnalyses() });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { artifact_id?: string; strategy_name?: string };
  if (!body.artifact_id) {
    return NextResponse.json({ error: { code: "invalid_payload", message: "artifact_id is required" } }, { status: 400 });
  }

  try {
    const response = createAnalysisFromArtifact({ artifact_id: body.artifact_id, strategy_name: body.strategy_name });
    return NextResponse.json(response, { status: 201 });
  } catch {
    return NextResponse.json({ error: { code: "artifact_not_eligible", message: "Artifact is not eligible for analysis." } }, { status: 422 });
  }
}
