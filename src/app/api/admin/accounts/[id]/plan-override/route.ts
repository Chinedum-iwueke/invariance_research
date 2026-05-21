import { NextResponse } from "next/server";
import type { PlanId } from "@/lib/contracts/account";
import { requireAdminSession } from "@/lib/server/admin/guards";
import { accountService } from "@/lib/server/accounts/service";
import { PLAN_MATRIX } from "@/lib/server/entitlements/plans";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdminSession();
  const { id } = await params;
  const body = await request.json().catch(() => ({})) as { plan_id?: PlanId };
  if (!body.plan_id || !PLAN_MATRIX[body.plan_id]) {
    return NextResponse.json({ error: { code: "invalid_plan", message: "A valid launch plan is required." } }, { status: 400 });
  }
  try {
    const account = await accountService.applyAdminPlanOverride({ account_id: id, plan_id: body.plan_id });
    return NextResponse.json({ account_id: account.account_id, plan_id: account.plan_id, subscription_status: account.subscription_status });
  } catch {
    return NextResponse.json({ error: { code: "account_not_found", message: "Account not found." } }, { status: 404 });
  }
}
