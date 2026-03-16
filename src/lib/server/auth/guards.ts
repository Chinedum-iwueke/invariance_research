import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/server/auth/session";

export async function requireAppSessionOrRedirect() {
  const session = await getServerSession();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}
