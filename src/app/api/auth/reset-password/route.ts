import { NextResponse } from "next/server";
import { accountService } from "@/lib/server/accounts/service";
import { validatePasswordPolicy } from "@/lib/server/auth/password-policy";
import { assertSameOrigin } from "@/lib/server/auth/security";

export async function POST(request: Request) {
  assertSameOrigin(request);
  const body = (await request.json().catch(() => ({}))) as { token?: string; password?: string; confirm_password?: string };
  const token = String(body.token ?? "");
  const password = String(body.password ?? "");
  const confirmPassword = String(body.confirm_password ?? "");

  if (!token) return NextResponse.json({ error: { code: "token_required", message: "Reset token is required." } }, { status: 400 });
  if (password !== confirmPassword) return NextResponse.json({ error: { code: "password_mismatch", message: "Password and confirmation must match." } }, { status: 400 });
  const passwordError = validatePasswordPolicy(password);
  if (passwordError) return NextResponse.json({ error: { code: "weak_password", message: passwordError } }, { status: 400 });

  const result = await accountService.resetPassword({ token, password });
  if (!result.ok) {
    return NextResponse.json({ error: { code: "invalid_or_expired", message: "This reset link is invalid or expired." } }, { status: 400 });
  }
  return NextResponse.json({ ok: true, message: "Your password has been updated. Please sign in again." });
}
