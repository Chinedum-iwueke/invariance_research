import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/server/auth/session";
import { isBenchmarkId } from "@/lib/benchmarks/benchmark-ids";
import { createAnalysisFromArtifact, listAnalyses } from "@/lib/server/services/analysis-service";

export async function GET() {
  const session = await requireServerSession();
  return NextResponse.json({ items: listAnalyses(session.account_id) });
}

export async function POST(request: Request) {
  const session = await requireServerSession();
  const body = (await request.json()) as {
    artifact_id?: string;
    strategy_name?: string;
    benchmark?: { mode?: "auto" | "none" | "manual"; requested_id?: string | null };
  };
  if (!body.artifact_id) {
    return NextResponse.json({ error: { code: "invalid_payload", message: "artifact_id is required" } }, { status: 400 });
  }


  const benchmarkMode = body.benchmark?.mode === "manual" || body.benchmark?.mode === "none" || body.benchmark?.mode === "auto"
    ? body.benchmark.mode
    : "auto";
  const rawRequestedId = body.benchmark?.requested_id ?? null;
  const requestedId = rawRequestedId && isBenchmarkId(rawRequestedId) ? rawRequestedId : null;
  const benchmark = {
    mode: benchmarkMode,
    requested_id: benchmarkMode === "manual" ? requestedId : null,
  } as const;

  try {
    const response = await createAnalysisFromArtifact({
      artifact_id: body.artifact_id,
      strategy_name: body.strategy_name,
      owner_user_id: session.user_id,
      account_id: session.account_id,
      benchmark,
    });
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "artifact_not_eligible";
    const status = code === "monthly_analysis_limit_reached" ? 429 : code === "artifact_access_denied" ? 403 : 422;
    const messageByCode: Record<string, string> = {
      artifact_not_eligible: "Artifact is not eligible for analysis. Re-run upload inspection for validation details.",
      artifact_access_denied: "Artifact access denied for the current account.",
      monthly_analysis_limit_reached: "Monthly analysis limit reached for this account.",
    };
    const message = messageByCode[code] ?? "Analysis cannot be started for this account.";
    console.error("[api/analyses] create failed", {
      account_id: session.account_id,
      user_id: session.user_id,
      artifact_id: body.artifact_id,
      code,
      status,
    });
    return NextResponse.json({ error: { code, message } }, { status });
  }
}
