import { NextResponse } from "next/server";
import { accountService } from "@/lib/server/accounts/service";
import { createBillingPortalSession } from "@/lib/server/billing/stripe-portal";
import { requireServerSession } from "@/lib/server/auth/session";

export async function POST() {
  const session = await requireServerSession();
  const state = accountService.getAccountState(session.account_id);
  const customerId = state?.subscription?.provider_customer_id;
  if (!customerId) {
    return NextResponse.json({ error: { code: "no_active_billing", message: "No active billing customer found." } }, { status: 404 });
  }

  const portal = await createBillingPortalSession(customerId);
  return NextResponse.json({ url: portal.url });
}
