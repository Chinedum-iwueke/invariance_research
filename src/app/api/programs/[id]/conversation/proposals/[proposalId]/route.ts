import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/server/auth/session";
import { enforceRateLimit } from "@/lib/server/rate-limits";
import { decideProgramProposal } from "@/lib/server/research-copilot/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string; proposalId: string }> }) {
  const session = await requireServerSession();
  const limited = await enforceRateLimit({ request, route: "program_proposal_decision", kind: "program_write", userId: session.user_id, accountId: session.account_id });
  if (limited) return limited;
  const { id, proposalId } = await params;
  const body = await request.json().catch(() => ({})) as { decision?: "confirmed" | "rejected" };
  if (body.decision !== "confirmed" && body.decision !== "rejected") return NextResponse.json({ error: { code: "decision_invalid", message: "Decision must be confirmed or rejected." } }, { status: 400 });
  try {
    await decideProgramProposal({ programId: id, accountId: session.account_id, userId: session.user_id, proposalId, decision: body.decision });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "proposal_decision_failed";
    return NextResponse.json({ error: { code: message, message } }, { status: /not_found/.test(message) ? 404 : 400 });
  }
}
