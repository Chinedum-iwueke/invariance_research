import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/server/admin/guards";
import { retryAdminJob } from "@/lib/server/admin/jobs-service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdminSession();
  const body = await request.formData();
  const rawKind = String(body.get("kind") ?? "");
  const kind = rawKind === "export" || rawKind === "experiment" ? rawKind : "analysis";
  const { id } = await params;
  try {
    const result = await retryAdminJob({ kind, linked_id: id });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "retry_not_allowed" }, { status: 422 });
  }
}
