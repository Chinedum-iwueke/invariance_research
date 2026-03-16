import { NextResponse } from "next/server";
import type { PlanId } from "@/lib/contracts/account";
import { createSubscriptionCheckout } from "@/lib/server/billing/stripe-checkout";
import { requireServerSession } from "@/lib/server/auth/session";

export async function POST(request: Request) {
  const session = await requireServerSession();
  const body = (await request.json()) as { plan_id?: PlanId };
  if (!body.plan_id) {
    return NextResponse.json({ error: { code: "invalid_payload", message: "plan_id is required" } }, { status: 400 });
  }

  try {
    const checkout = await createSubscriptionCheckout({
      accountId: session.account_id,
      userEmail: session.email,
      planId: body.plan_id,
    });
    return NextResponse.json({ url: checkout.url });
  } catch {
    return NextResponse.json({ error: { code: "checkout_unavailable", message: "Unable to start checkout for this plan." } }, { status: 422 });
  }
}
