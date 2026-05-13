import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/server/auth/session";

export async function requireAppSessionOrRedirect() {
  const session = await getServerSession();
  if (!session?.user?.email || !session.user.id || !session.user.account_id) {
    redirect("/login");
  }
  return session;
}
