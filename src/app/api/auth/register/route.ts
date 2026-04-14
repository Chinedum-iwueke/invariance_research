import { NextResponse } from "next/server";
import { accountService } from "@/lib/server/accounts/service";

function validatePassword(password: string): string | null {
  if (password.length < 10) return "Password must be at least 10 characters.";
  if (!/[A-Z]/.test(password)) return "Password must include at least one uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password must include at least one lowercase letter.";
  if (!/[0-9]/.test(password)) return "Password must include at least one number.";
  return null;
}

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; name?: string; password?: string; confirm_password?: string };

  const email = String(body.email ?? "").trim().toLowerCase();
  const name = String(body.name ?? "").trim();
  const password = String(body.password ?? "");
  const confirmPassword = String(body.confirm_password ?? "");

  if (!email) {
    return NextResponse.json({ error: { code: "email_required", message: "Email is required." } }, { status: 400 });
  }
  if (!password) {
    return NextResponse.json({ error: { code: "password_required", message: "Password is required." } }, { status: 400 });
  }
  if (password !== confirmPassword) {
    return NextResponse.json({ error: { code: "password_mismatch", message: "Password and confirmation must match." } }, { status: 400 });
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return NextResponse.json({ error: { code: "weak_password", message: passwordError } }, { status: 400 });
  }

  try {
    const created = accountService.createUserAndAccountWithPassword({
      email,
      name: name || undefined,
      password,
    });
    return NextResponse.json({ user_id: created.user.user_id, account_id: created.account.account_id }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "signup_failed";
    const message = code === "email_already_registered" ? "An account with that email already exists." : "Unable to create account.";
    return NextResponse.json({ error: { code, message } }, { status: code === "email_already_registered" ? 409 : 422 });
  }
}
