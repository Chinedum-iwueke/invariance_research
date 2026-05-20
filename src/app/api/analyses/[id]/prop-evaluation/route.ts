import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/server/auth/session";
import { recomputePropEvaluationForAnalysis } from "@/lib/server/prop-evaluation/prop-evaluation-service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const { id } = await params;
  const body = await readJson(request);

  try {
    const response = await recomputePropEvaluationForAnalysis({
      analysisId: id,
      accountId: session.account_id,
      userId: session.user_id,
      rules: body?.rules && typeof body.rules === "object" ? body.rules as Record<string, unknown> : undefined,
    });
    return NextResponse.json({
      rule_snapshot_id: response.rule_snapshot_id,
      result: response.result,
      diagnostic: response.diagnostic,
      rules: response.rules,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "prop_evaluation_failed";
    const status = code === "analysis_not_found" || code === "artifact_not_found" ? 404 : 422;
    return NextResponse.json({ error: { code, message: "Prop evaluation could not be recomputed." } }, { status });
  }
}

async function readJson(request: Request): Promise<Record<string, unknown> | undefined> {
  try {
    return await request.json() as Record<string, unknown>;
  } catch {
    return undefined;
  }
}
