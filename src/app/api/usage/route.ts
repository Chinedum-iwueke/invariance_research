import { NextResponse } from "next/server";
import { accountService } from "@/lib/server/accounts/service";
import { requireServerSession } from "@/lib/server/auth/session";

export async function GET() {
  const session = await requireServerSession();
  const usage = accountService.getUsage(session.account_id);
  return NextResponse.json({ usage });
}
