import { NextResponse } from "next/server";
import { accountService } from "@/lib/server/accounts/service";
import { validatePasswordPolicy } from "@/lib/server/auth/password-policy";
import { assertSameOrigin } from "@/lib/server/auth/security";
import { enforceRateLimit } from "@/lib/server/rate-limits";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ error: { code: "invalid_origin", message: "Signup request origin is not allowed." } }, { status: 403 });
  }
  const body = (await request.json()) as { email?: string; name?: string; password?: string; confirm_password?: string };

  const email = String(body.email ?? "").trim().toLowerCase();
  const name = String(body.name ?? "").trim();
  const password = String(body.password ?? "");
  const confirmPassword = String(body.confirm_password ?? "");
  const limited = await enforceRateLimit({ request, route: "signup", kind: "auth", email });
  if (limited) return limited;

  if (!email) {
    return NextResponse.json({ error: { code: "email_required", message: "Email is required." } }, { status: 400 });
  }
  if (!password) {
    return NextResponse.json({ error: { code: "password_required", message: "Password is required." } }, { status: 400 });
  }
  if (password !== confirmPassword) {
    return NextResponse.json({ error: { code: "password_mismatch", message: "Password and confirmation must match." } }, { status: 400 });
  }

  const passwordError = validatePasswordPolicy(password);
  if (passwordError) {
    return NextResponse.json({ error: { code: "weak_password", message: passwordError } }, { status: 400 });
  }

  try {
    const created = await accountService.createUserAndAccountWithPassword({
      email,
      name: name || undefined,
      password,
    });
    return NextResponse.json({ user_id: created.user.user_id, account_id: created.account.account_id, verification_required: true }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "signup_failed";
    const message = code === "email_already_registered" ? "An account with that email already exists." : "Unable to create account.";
    return NextResponse.json({ error: { code, message } }, { status: code === "email_already_registered" ? 409 : 422 });
  }
}
