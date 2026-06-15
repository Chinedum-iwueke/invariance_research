import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/server/auth/session";
import {
  approveHypothesisVersion,
  createHypothesisFromBrief,
  saveManualHypothesisVersion,
} from "@/lib/server/research-programs/service";
import { enforceRateLimit } from "@/lib/server/rate-limits";
import { isOperationalPauseError } from "@/lib/server/ops/operations-policy";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const limited = await enforceRateLimit({ request, route: "program_hypotheses", kind: "assistant", userId: session.user_id, accountId: session.account_id });
  if (limited) return limited;
  const { id } = await params;
  const body = await request.json().catch(() => ({})) as {
    action?: "generate_from_brief" | "approve" | "save_manual";
    brief_id?: string;
    hypothesis_version_id?: string;
    spec?: unknown;
  };

  try {
    if (body.action === "approve") {
      if (!body.hypothesis_version_id) {
        return NextResponse.json({ error: { code: "hypothesis_version_id_required", message: "Hypothesis version is required." } }, { status: 400 });
      }
      await approveHypothesisVersion({
        program_id: id,
        hypothesis_version_id: body.hypothesis_version_id,
        account_id: session.account_id,
        user_id: session.user_id,
      });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "save_manual") {
      if (!body.hypothesis_version_id) {
        return NextResponse.json({ error: { code: "hypothesis_version_id_required", message: "Hypothesis version is required." } }, { status: 400 });
      }
      if (!body.spec || typeof body.spec !== "object") {
        return NextResponse.json({ error: { code: "spec_required", message: "Hypothesis spec JSON is required." } }, { status: 400 });
      }
      const hypothesis = await saveManualHypothesisVersion({
        program_id: id,
        hypothesis_version_id: body.hypothesis_version_id,
        account_id: session.account_id,
        user_id: session.user_id,
        spec: body.spec as never,
      });
      return NextResponse.json({ hypothesis });
    }

    if (!body.brief_id) {
      return NextResponse.json({ error: { code: "brief_id_required", message: "Research brief is required." } }, { status: 400 });
    }
    const hypothesis = await createHypothesisFromBrief({
      program_id: id,
      brief_id: body.brief_id,
      account_id: session.account_id,
      user_id: session.user_id,
    });
    return NextResponse.json({ hypothesis });
  } catch (error) {
    const message = error instanceof Error ? error.message : "hypothesis_action_failed";
    const status = isOperationalPauseError(message) ? 503 : /not_found/.test(message) ? 404 : /required|invalid|not_approved|limit/.test(message) ? 400 : 500;
    return NextResponse.json({ error: { code: message, message } }, { status });
  }
}
