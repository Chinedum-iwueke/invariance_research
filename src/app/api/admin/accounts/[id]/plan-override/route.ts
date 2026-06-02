import { NextResponse } from "next/server";
import type { PlanId } from "@/lib/contracts/account";
import { requireAdminSession } from "@/lib/server/admin/guards";
import { writeAdminAuditLog } from "@/lib/server/admin/audit-log";
import { accountService } from "@/lib/server/accounts/service";
import { PLAN_MATRIX } from "@/lib/server/entitlements/plans";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAdminSession();
  const { id } = await params;
  const body = await request.json().catch(() => ({})) as { plan_id?: PlanId };
  if (!body.plan_id || !PLAN_MATRIX[body.plan_id]) {
    return NextResponse.json({ error: { code: "invalid_plan", message: "A valid plan is required." } }, { status: 400 });
  }
  try {
    const account = await accountService.applyAdminPlanOverride({ account_id: id, plan_id: body.plan_id });
    await writeAdminAuditLog({
      actor,
      action: "account.plan_override",
      resourceType: "account",
      resourceId: id,
      metadata: { plan_id: account.plan_id, requested_plan_id: body.plan_id },
      request,
    });
    return NextResponse.json({ account_id: account.account_id, plan_id: account.plan_id, subscription_status: account.subscription_status });
  } catch {
    return NextResponse.json({ error: { code: "account_not_found", message: "Account not found." } }, { status: 404 });
  }
}
