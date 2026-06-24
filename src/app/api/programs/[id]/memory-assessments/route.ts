import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/server/auth/session";
import { enforceRateLimit } from "@/lib/server/rate-limits";
import {
  createMemoryAssessment,
  getC4Detail,
  ingestBacktestTradeMemory,
  syncGovernedResearchMemory,
} from "@/lib/server/research-c4/service";
import type { ResearchStage } from "@/lib/server/research-c4/models";

const STAGES = new Set<ResearchStage>(["backtest", "demo", "live_canary", "live"]);

type C4ActionBody = {
  action?: string;
  strategy_spec_hash?: string;
  symbol?: string;
  stage?: ResearchStage;
  features?: Record<string, unknown>;
  feature_timestamps?: Record<string, string>;
  missing_features?: string[];
  run_id?: string;
  deployment_id?: string;
  decision_at?: string;
};

function normalizeFeatures(value: Record<string, unknown> | undefined) {
  const entries = Object.entries(value ?? {});
  if (entries.length > 64) throw new Error("state_feature_limit_exceeded");
  const features: Record<string, number> = {};
  for (const [rawKey, rawValue] of entries) {
    const key = rawKey.trim();
    const value = Number(rawValue);
    if (!/^[a-zA-Z0-9_.:-]{1,64}$/.test(key)) throw new Error("state_feature_name_invalid");
    if (!Number.isFinite(value)) throw new Error(`state_feature_non_finite:${key}`);
    features[key] = value;
  }
  return features;
}

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireServerSession();
  const { id } = await params;
  return NextResponse.json({ detail: await getC4Detail(id, session.account_id) });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireServerSession();
  const limited = await enforceRateLimit({
    request,
    route: "research_c4",
    kind: "program_write",
    userId: session.user_id,
    accountId: session.account_id,
  });
  if (limited) return limited;
  if (Number(request.headers.get("content-length") ?? 0) > 64_000) {
    return NextResponse.json(
      { error: { code: "request_too_large", message: "Memory actions are limited to 64 KB." } },
      { status: 413 },
    );
  }
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as C4ActionBody;
  try {
    if (body.action === "sync_backtest") {
      return NextResponse.json({ result: await ingestBacktestTradeMemory(id, session.account_id) });
    }
    if (body.action === "sync_governed") {
      return NextResponse.json({ result: await syncGovernedResearchMemory(id, session.account_id) });
    }
    if (body.action === "assess") {
      if (!body.strategy_spec_hash?.trim()) throw new Error("strategy_spec_hash_required");
      if (!body.symbol?.trim()) throw new Error("symbol_required");
      const stage = body.stage ?? "backtest";
      if (!STAGES.has(stage)) throw new Error("research_stage_invalid");
      if (stage !== "backtest" && !body.deployment_id) throw new Error("deployment_id_required");
      const features = normalizeFeatures(body.features);
      if (!Object.keys(features).length) throw new Error("state_features_required");
      return NextResponse.json({
        assessment: await createMemoryAssessment({
          programId: id,
          accountId: session.account_id,
          userId: session.user_id,
          strategySpecHash: body.strategy_spec_hash.trim(),
          symbol: body.symbol.trim().toUpperCase(),
          stage,
          features,
          featureTimestamps: body.feature_timestamps,
          missingFeatures: (body.missing_features ?? []).slice(0, 64).map(String),
          runId: body.run_id,
          deploymentId: body.deployment_id,
          decisionAt: body.decision_at,
        }),
      });
    }
    throw new Error("memory_action_invalid");
  } catch (error) {
    const message = error instanceof Error ? error.message : "memory_action_failed";
    return NextResponse.json(
      { error: { code: message.split(":")[0], message } },
      { status: /not_found/.test(message) ? 404 : 400 },
    );
  }
}
