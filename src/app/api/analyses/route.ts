import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/server/auth/session";
import { isBenchmarkId } from "@/lib/benchmarks/benchmark-ids";
import { createAnalysisFromArtifact, listAnalyses } from "@/lib/server/services/analysis-service";
import { enforceRateLimit } from "@/lib/server/rate-limits";
import type { DeclaredStrategyClaim } from "@/lib/server/ingestion";

export async function GET() {
  const session = await requireServerSession();
  return NextResponse.json({ items: await listAnalyses(session.account_id) });
}

export async function POST(request: Request) {
  const session = await requireServerSession();
  const limited = await enforceRateLimit({ request, route: "analysis_create", kind: "analysis_create", userId: session.user_id, accountId: session.account_id });
  if (limited) return limited;
  const body = (await request.json()) as {
    artifact_id?: string;
    strategy_name?: string;
    benchmark?: { mode?: "auto" | "none" | "manual"; requested_id?: string | null };
    runtime_config?: {
      account_size?: number;
      risk_per_trade_pct?: number;
      prop_evaluation_rules?: Record<string, unknown>;
      declared_claims?: unknown;
    };
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
  const accountSize = typeof body.runtime_config?.account_size === "number" && Number.isFinite(body.runtime_config.account_size) && body.runtime_config.account_size > 0
    ? body.runtime_config.account_size
    : undefined;
  const riskPerTradePct = typeof body.runtime_config?.risk_per_trade_pct === "number" && Number.isFinite(body.runtime_config.risk_per_trade_pct) && body.runtime_config.risk_per_trade_pct > 0
    ? body.runtime_config.risk_per_trade_pct
    : undefined;
  const declaredClaims = normalizeDeclaredClaims(body.runtime_config?.declared_claims);

  try {
    const response = await createAnalysisFromArtifact({
      artifact_id: body.artifact_id,
      strategy_name: body.strategy_name,
      owner_user_id: session.user_id,
      account_id: session.account_id,
      benchmark,
      runtime_config: {
        account_size: accountSize,
        risk_per_trade_pct: riskPerTradePct,
        prop_evaluation_rules: body.runtime_config?.prop_evaluation_rules,
        declared_claims: declaredClaims,
      },
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

function normalizeDeclaredClaims(input: unknown): DeclaredStrategyClaim[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const seen = new Set<string>();
  const claims = input
    .map((item, index): DeclaredStrategyClaim | undefined => {
      if (!item || typeof item !== "object") return undefined;
      const record = item as Record<string, unknown>;
      const claim = typeof record.claim === "string" ? record.claim.trim() : "";
      if (!claim) return undefined;
      const key = claim.toLowerCase();
      if (seen.has(key)) return undefined;
      seen.add(key);
      const priority = record.priority === "low" || record.priority === "medium" || record.priority === "high" || record.priority === "critical"
        ? record.priority
        : "high";
      return {
        claim_id: typeof record.claim_id === "string" && record.claim_id.trim() ? record.claim_id.trim().slice(0, 64) : `user_claim_${index + 1}`,
        claim: claim.slice(0, 280),
        source: "analysis_intake",
        priority,
      };
    })
    .filter((item): item is DeclaredStrategyClaim => Boolean(item))
    .slice(0, 8);

  return claims.length ? claims : undefined;
}
