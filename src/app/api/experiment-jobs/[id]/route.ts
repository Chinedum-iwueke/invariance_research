import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/server/auth/session";
import { updateExperimentJobControl } from "@/lib/server/research-programs/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const { id } = await params;
  const body = await request.json().catch(() => ({})) as {
    action?: "pause" | "cancel" | "retry" | "priority";
    priority?: number;
  };

  if (!body.action || !["pause", "cancel", "retry", "priority"].includes(body.action)) {
    return NextResponse.json({ error: { code: "invalid_action", message: "Unsupported job action." } }, { status: 400 });
  }

  try {
    await updateExperimentJobControl({
      job_id: id,
      account_id: session.account_id,
      user_id: session.user_id,
      action: body.action,
      priority: body.priority,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "experiment_job_action_failed";
    const status = /not_found/.test(message) ? 404 : /required|invalid/.test(message) ? 400 : 500;
    return NextResponse.json({ error: { code: message, message } }, { status });
  }
}
