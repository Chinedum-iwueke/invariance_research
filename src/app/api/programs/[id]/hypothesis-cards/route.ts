import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/server/auth/session";
import { enforceRateLimit } from "@/lib/server/rate-limits";
import { approveImplementationTask, approveResearchSpecBundle, confirmHypothesisCard, createCardFromProposal, generateResearchSpecBundle, getResearchSpecBridgeDetail, reviseCard, submitImplementationEvidence } from "@/lib/server/research-specs-v2/service";
import type { HypothesisCardV1 } from "@/lib/server/research-specs-v2/models";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const { id } = await params;
  return NextResponse.json({ detail: await getResearchSpecBridgeDetail(id, session.account_id) });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const limited = await enforceRateLimit({ request, route: "hypothesis_card_bridge", kind: "program_write", userId: session.user_id, accountId: session.account_id });
  if (limited) return limited;
  const { id } = await params;
  const body = await request.json().catch(() => ({})) as { action?: string; proposal_id?: string; card_record_id?: string; card?: HypothesisCardV1; available_datasets?: string[]; spec_bundle_id?: string; task_id?: string; evidence?: Record<string, unknown> };
  try {
    if (body.action === "create_from_proposal" && body.proposal_id) return NextResponse.json({ card: await createCardFromProposal({ programId: id, proposalId: body.proposal_id, accountId: session.account_id, userId: session.user_id }) });
    if (body.action === "revise" && body.card_record_id && body.card) return NextResponse.json({ card: await reviseCard({ programId: id, cardRecordId: body.card_record_id, card: body.card, accountId: session.account_id, userId: session.user_id }) });
    if (body.action === "confirm" && body.card_record_id) return NextResponse.json({ card: await confirmHypothesisCard({ programId: id, cardRecordId: body.card_record_id, accountId: session.account_id, userId: session.user_id }) });
    if (body.action === "generate" && body.card_record_id) return NextResponse.json({ bundle: await generateResearchSpecBundle({ programId: id, cardRecordId: body.card_record_id, accountId: session.account_id, userId: session.user_id, availableDatasets: body.available_datasets }) });
    if (body.action === "approve_bundle" && body.spec_bundle_id) { await approveResearchSpecBundle({ programId: id, bundleId: body.spec_bundle_id, accountId: session.account_id, userId: session.user_id }); return NextResponse.json({ ok: true }); }
    if (body.action === "submit_task_evidence" && body.task_id && body.evidence) return NextResponse.json({ task: await submitImplementationEvidence({ programId: id, taskId: body.task_id, evidence: body.evidence, accountId: session.account_id, userId: session.user_id }) });
    if (body.action === "approve_task" && body.task_id) return NextResponse.json({ task: await approveImplementationTask({ programId: id, taskId: body.task_id, accountId: session.account_id, userId: session.user_id }) });
    return NextResponse.json({ error: { code: "action_invalid", message: "A valid card/spec action is required." } }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "hypothesis_card_action_failed";
    return NextResponse.json({ error: { code: message.split(";")[0], message } }, { status: /not_found/.test(message) ? 404 : /already/.test(message) ? 409 : 400 });
  }
}
