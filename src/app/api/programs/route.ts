import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/server/auth/session";
import { enforceRateLimit } from "@/lib/server/rate-limits";
import { createResearchProgram } from "@/lib/server/research-programs/service";
import { sendProgramCopilotMessage } from "@/lib/server/research-copilot/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeContent(value: unknown) {
  return String(value ?? "").trim().slice(0, 20_000);
}

function titleFromContent(content: string) {
  const firstLine = content
    .split(/\n+/)
    .map((line) => line.trim())
    .find(Boolean);
  const candidate = (firstLine ?? content).replace(/\s+/g, " ").slice(0, 120);
  if (!candidate) return "Untitled crypto research thread";
  return candidate.length > 84 ? `${candidate.slice(0, 81)}...` : candidate;
}

export async function POST(request: Request) {
  const session = await requireServerSession();
  const limited = await enforceRateLimit({
    request,
    route: "program_create_from_chat",
    kind: "program_write",
    userId: session.user_id,
    accountId: session.account_id,
  });
  if (limited) return limited;

  const body = (await request.json().catch(() => ({}))) as {
    content?: unknown;
    open_source_uploader?: unknown;
  };
  const content = normalizeContent(body.content);
  if (content.length < 10) {
    return NextResponse.json(
      {
        error: {
          code: "research_message_required",
          message: "Describe the strategy, paper, or hypothesis you want to test.",
        },
      },
      { status: 400 },
    );
  }

  try {
    const program = await createResearchProgram({
      account_id: session.account_id,
      owner_user_id: session.user_id,
      title: titleFromContent(content),
      thesis: content,
      market: "crypto",
    });
    let assistantStatus: "completed" | "failed" = "completed";
    let assistantError: string | undefined;
    try {
      await sendProgramCopilotMessage({
        programId: program.program_id,
        accountId: session.account_id,
        userId: session.user_id,
        content,
      });
    } catch (error) {
      assistantStatus = "failed";
      assistantError = error instanceof Error ? error.message : "copilot_turn_failed";
    }

    const sourceQuery = body.open_source_uploader === true ? "?source=1" : "";
    return NextResponse.json(
      {
        program,
        redirect_url: `/app/programs/${program.program_id}${sourceQuery}`,
        assistant_status: assistantStatus,
        assistant_error: assistantError,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "program_create_failed";
    const status = /limit|required|invalid/.test(message) ? 400 : 500;
    return NextResponse.json({ error: { code: message, message } }, { status });
  }
}
