import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/server/auth/session";

export default async function AccountPage() {
  const session = await getServerSession();
  if (!session?.user?.email || !session.user.id || !session.user.account_id) {
    redirect("/logout?reason=stale-session");
  }

  redirect("/app");
}
