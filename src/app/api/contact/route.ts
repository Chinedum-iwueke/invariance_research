import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimit } from "@/lib/server/rate-limits";

const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email(),
  strategyType: z.string().trim().min(1).max(160),
  message: z.string().trim().min(1).max(4000),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = contactSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "invalid_payload", message: "Please complete the form and try again." } }, { status: 400 });
  }
  const limited = await enforceRateLimit({ request, route: "contact", kind: "waitlist", email: parsed.data.email });
  if (limited) return limited;
  return NextResponse.json({ ok: true, message: "Thank you. We received your request." }, { status: 202 });
}
