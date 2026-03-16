import { redirect } from "next/navigation";
import { requireServerSession } from "@/lib/server/auth/session";

function parseAllowlist(value?: string): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAdminIdentity(input: { user_id: string; email: string }): boolean {
  const emails = parseAllowlist(process.env.ADMIN_EMAILS);
  const ids = parseAllowlist(process.env.ADMIN_USER_IDS);
  return emails.has(input.email.toLowerCase()) || ids.has(input.user_id.toLowerCase());
}

export async function requireAdminSession() {
  const session = await requireServerSession();
  if (!isAdminIdentity({ user_id: session.user_id, email: session.email })) {
    throw new Error("forbidden");
  }
  return session;
}

export async function requireAdminSessionOrRedirect() {
  try {
    return await requireAdminSession();
  } catch {
    redirect("/app");
  }
}
