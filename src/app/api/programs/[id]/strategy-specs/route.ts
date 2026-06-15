import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/server/auth/session";
import {
  approveStrategySpec,
  createStrategySpecFromHypothesis,
  saveManualStrategySpec,
} from "@/lib/server/research-programs/service";
import { enforceRateLimit } from "@/lib/server/rate-limits";
import { isOperationalPauseError } from "@/lib/server/ops/operations-policy";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const limited = await enforceRateLimit({ request, route: "program_strategy_specs", kind: "assistant", userId: session.user_id, accountId: session.account_id });
  if (limited) return limited;
  const { id } = await params;
  const body = await request.json().catch(() => ({})) as {
    action?: "generate_from_hypothesis" | "approve" | "save_manual";
    hypothesis_version_id?: string;
    strategy_spec_record_id?: string;
    spec?: unknown;
  };

  try {
    if (body.action === "approve") {
      if (!body.strategy_spec_record_id) {
        return NextResponse.json({ error: { code: "strategy_spec_record_id_required", message: "Strategy spec is required." } }, { status: 400 });
      }
      await approveStrategySpec({
        program_id: id,
        strategy_spec_record_id: body.strategy_spec_record_id,
        account_id: session.account_id,
        user_id: session.user_id,
      });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "save_manual") {
      if (!body.strategy_spec_record_id) {
        return NextResponse.json({ error: { code: "strategy_spec_record_id_required", message: "Strategy spec is required." } }, { status: 400 });
      }
      if (!body.spec || typeof body.spec !== "object") {
        return NextResponse.json({ error: { code: "spec_required", message: "Strategy spec JSON is required." } }, { status: 400 });
      }
      const strategySpec = await saveManualStrategySpec({
        program_id: id,
        strategy_spec_record_id: body.strategy_spec_record_id,
        account_id: session.account_id,
        user_id: session.user_id,
        spec: body.spec as never,
      });
      return NextResponse.json({ strategy_spec: strategySpec });
    }

    if (!body.hypothesis_version_id) {
      return NextResponse.json({ error: { code: "hypothesis_version_id_required", message: "Approved hypothesis version is required." } }, { status: 400 });
    }
    const strategySpec = await createStrategySpecFromHypothesis({
      program_id: id,
      hypothesis_version_id: body.hypothesis_version_id,
      account_id: session.account_id,
      user_id: session.user_id,
    });
    return NextResponse.json({ strategy_spec: strategySpec });
  } catch (error) {
    const message = error instanceof Error ? error.message : "strategy_spec_action_failed";
    const status = isOperationalPauseError(message) ? 503 : /not_found/.test(message) ? 404 : /required|invalid|not_approved|limit/.test(message) ? 400 : 500;
    return NextResponse.json({ error: { code: message, message } }, { status });
  }
}
