import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/server/auth/session";
import {
  approveExperimentPlan,
  createExperimentPlanFromStrategySpec,
  queueExperimentPlan,
} from "@/lib/server/research-programs/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const { id } = await params;
  const body = await request.json().catch(() => ({})) as {
    action?: "generate_from_strategy" | "approve" | "queue";
    strategy_spec_record_id?: string;
    experiment_plan_id?: string;
  };

  try {
    if (body.action === "approve") {
      if (!body.experiment_plan_id) {
        return NextResponse.json({ error: { code: "experiment_plan_id_required", message: "Experiment plan is required." } }, { status: 400 });
      }
      await approveExperimentPlan({
        program_id: id,
        experiment_plan_id: body.experiment_plan_id,
        account_id: session.account_id,
        user_id: session.user_id,
      });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "queue") {
      if (!body.experiment_plan_id) {
        return NextResponse.json({ error: { code: "experiment_plan_id_required", message: "Experiment plan is required." } }, { status: 400 });
      }
      const result = await queueExperimentPlan({
        program_id: id,
        experiment_plan_id: body.experiment_plan_id,
        account_id: session.account_id,
        user_id: session.user_id,
      });
      return NextResponse.json(result);
    }

    if (!body.strategy_spec_record_id) {
      return NextResponse.json({ error: { code: "strategy_spec_record_id_required", message: "Approved strategy spec is required." } }, { status: 400 });
    }
    const plan = await createExperimentPlanFromStrategySpec({
      program_id: id,
      strategy_spec_record_id: body.strategy_spec_record_id,
      account_id: session.account_id,
      user_id: session.user_id,
    });
    return NextResponse.json({ plan });
  } catch (error) {
    const message = error instanceof Error ? error.message : "experiment_plan_action_failed";
    const status = /not_found/.test(message) ? 404 : /required|invalid|not_approved|limit|budget/.test(message) ? 400 : 500;
    return NextResponse.json({ error: { code: message, message } }, { status });
  }
}
