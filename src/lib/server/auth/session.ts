import { auth } from "@/lib/server/auth/auth";

export async function getServerSession() {
  return auth();
}

export async function requireServerSession() {
  const session = await auth();
  if (!session?.user?.email || !session.user.id || !session.user.account_id) {
    throw new Error("unauthenticated");
  }
  return {
    user_id: session.user.id,
    account_id: session.user.account_id,
    email: session.user.email,
  };
}
