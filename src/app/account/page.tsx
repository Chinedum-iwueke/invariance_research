import { redirect } from "next/navigation";
import { requireServerSession } from "@/lib/server/auth/session";

export default async function AccountPage() {
  await requireServerSession();
  redirect("/app");
}
