import { redirect } from "next/navigation";
import { requireServerSession } from "@/lib/server/auth/session";
import { isBootstrapAdminIdentity, userHasAdminRole } from "@/lib/server/admin/roles";

export { isBootstrapAdminIdentity };

export async function isAdminIdentity(input: { user_id: string; email: string }): Promise<boolean> {
  return userHasAdminRole(input);
}

export async function requireAdminSession() {
  const session = await requireServerSession();
  if (!(await isAdminIdentity({ user_id: session.user_id, email: session.email }))) {
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
