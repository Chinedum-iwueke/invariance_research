import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/server/auth/session";
import {
  acceptClarificationSession,
  createClarificationSession,
} from "@/lib/server/research-programs/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const { id } = await params;
  const body = await request.json().catch(() => ({})) as {
    action?: "create" | "accept";
    intake?: unknown;
    session_id?: string;
    answers?: Record<string, string>;
  };

  try {
    if (body.action === "accept") {
      if (!body.session_id) {
        return NextResponse.json({ error: { code: "session_id_required", message: "Clarification session is required." } }, { status: 400 });
      }
      const brief = await acceptClarificationSession({
        program_id: id,
        session_id: body.session_id,
        account_id: session.account_id,
        user_id: session.user_id,
        answers: body.answers ?? {},
      });
      return NextResponse.json({ brief });
    }

    const clarification = await createClarificationSession({
      program_id: id,
      account_id: session.account_id,
      user_id: session.user_id,
      intake: body.intake,
    });
    return NextResponse.json({ clarification });
  } catch (error) {
    const message = error instanceof Error ? error.message : "clarification_failed";
    const status = /not_found/.test(message) ? 404 : /required|invalid|too_small/.test(message) ? 400 : 500;
    return NextResponse.json({ error: { code: message, message } }, { status });
  }
}
