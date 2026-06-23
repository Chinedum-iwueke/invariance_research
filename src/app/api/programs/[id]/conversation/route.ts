import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/server/auth/session";
import { enforceRateLimit } from "@/lib/server/rate-limits";
import { getProgramConversationDetail, sendProgramCopilotMessage } from "@/lib/server/research-copilot/service";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const { id } = await params;
  try {
    const detail = await getProgramConversationDetail({ programId: id, accountId: session.account_id, userId: session.user_id });
    return NextResponse.json({ detail });
  } catch (error) {
    const message = error instanceof Error ? error.message : "conversation_load_failed";
    return NextResponse.json({ error: { code: message, message } }, { status: /not_found/.test(message) ? 404 : 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const limited = await enforceRateLimit({ request, route: "program_conversation", kind: "assistant", userId: session.user_id, accountId: session.account_id });
  if (limited) return limited;
  const { id } = await params;
  const body = await request.json().catch(() => ({})) as { content?: string; source_ids?: string[] };
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      try {
        send("status", { state: "thinking" });
        const result = await sendProgramCopilotMessage({
          programId: id, accountId: session.account_id, userId: session.user_id,
          content: String(body.content ?? ""), sourceIds: Array.isArray(body.source_ids) ? body.source_ids.map(String) : [], signal: request.signal,
        });
        const words = result.message.content.split(/(\s+)/).filter(Boolean);
        for (let index = 0; index < words.length; index += 12) send("delta", { text: words.slice(index, index + 12).join("") });
        send("complete", result);
      } catch (error) {
        const message = error instanceof Error ? error.message : "copilot_turn_failed";
        send("error", { code: message, message, retryable: !/required|too_large|not_found|limit/.test(message) });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
