import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/server/auth/session";
import { enforceRateLimit } from "@/lib/server/rate-limits";
import {
  listLlmProviderConnections,
  revokeLlmProviderConnection,
  saveOpenAiConnection,
  testOpenAiApiKey,
} from "@/lib/server/llm-connections/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireServerSession();
  return NextResponse.json(await listLlmProviderConnections(session.account_id));
}

export async function POST(request: Request) {
  const session = await requireServerSession();
  const limited = await enforceRateLimit({
    request,
    route: "llm_connection_settings",
    kind: "assistant",
    userId: session.user_id,
    accountId: session.account_id,
  });
  if (limited) return limited;
  if (Number(request.headers.get("content-length") ?? 0) > 16_000) {
    return NextResponse.json({ error: { code: "request_too_large", message: "Provider settings are limited to 16 KB." } }, { status: 413 });
  }
  const body = await request.json().catch(() => ({})) as {
    action?: string;
    api_key?: string;
    model?: string;
    label?: string;
    connection_id?: string;
  };
  try {
    if (body.action === "test_openai") {
      return NextResponse.json({ result: await testOpenAiApiKey({ apiKey: String(body.api_key ?? ""), model: body.model }) });
    }
    if (body.action === "save_openai") {
      return NextResponse.json({
        connection: await saveOpenAiConnection({
          accountId: session.account_id,
          userId: session.user_id,
          apiKey: String(body.api_key ?? ""),
          model: body.model,
          label: body.label,
        }),
      });
    }
    if (body.action === "revoke") {
      return NextResponse.json({
        result: await revokeLlmProviderConnection({
          accountId: session.account_id,
          userId: session.user_id,
          connectionId: String(body.connection_id ?? ""),
        }),
      });
    }
    return NextResponse.json({ error: { code: "unsupported_action", message: "Unsupported provider settings action." } }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "llm_connection_action_failed";
    return NextResponse.json({ error: { code: message, message } }, { status: /not_found/.test(message) ? 404 : 400 });
  }
}
