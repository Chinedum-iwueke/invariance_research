import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimit } from "@/lib/server/rate-limits";
import { ingestTradingViewObservation } from "@/lib/server/research-c2/service";

const observationSchema = z
  .object({
    idempotency_key: z.string().min(8).max(200),
    symbol: z.string().min(1).max(40),
    timeframe: z.string().min(1).max(20),
    confirmed_bar_timestamp: z.string().datetime(),
    side: z.enum(["long", "short"]),
    event_type: z.enum(["entry", "exit", "invalidation"]),
    strategy_spec_hash: z.string().regex(/^[a-f0-9]{64}$/),
    confirmed: z.literal(true),
  })
  .strict();
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const limited = await enforceRateLimit({
    request,
    route: "tradingview_observation",
    kind: "share_access",
  });
  if (limited) return limited;
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token))
    return NextResponse.json(
      { error: { code: "credential_invalid" } },
      { status: 401 },
    );
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 32_768)
    return NextResponse.json(
      { error: { code: "payload_too_large" } },
      { status: 413 },
    );
  const parsed = observationSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      {
        error: {
          code: "observation_invalid",
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            code: issue.code,
          })),
        },
      },
      { status: 400 },
    );
  try {
    return NextResponse.json(
      { observation: await ingestTradingViewObservation(token, parsed.data) },
      { status: 202 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "observation_failed";
    return NextResponse.json(
      { error: { code: message.split("_").slice(0, 3).join("_"), message } },
      {
        status: /credential/.test(message)
          ? 401
          : /missing|unconfirmed/.test(message)
            ? 400
            : 409,
      },
    );
  }
}
