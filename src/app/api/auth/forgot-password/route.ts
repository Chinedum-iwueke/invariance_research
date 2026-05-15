import { NextResponse } from "next/server";
import { accountService } from "@/lib/server/accounts/service";
import { assertSameOrigin } from "@/lib/server/auth/security";
import { enforceRateLimit } from "@/lib/server/rate-limits";

export async function POST(request: Request) {
  assertSameOrigin(request);
  const body = (await request.json().catch(() => ({}))) as { email?: string };
  const email = String(body.email ?? "").trim().toLowerCase();
  const limited = await enforceRateLimit({ request, route: "forgot_password", kind: "auth", email });
  if (limited) return limited;
  if (email) {
    await accountService.requestPasswordReset({ email });
  }
  return NextResponse.json({ ok: true, message: "If an account exists for that email, password reset instructions have been sent." });
}
