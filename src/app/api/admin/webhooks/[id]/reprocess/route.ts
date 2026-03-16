import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/server/admin/guards";
import { reprocessAdminWebhook } from "@/lib/server/admin/webhooks-service";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdminSession();
  const { id } = await params;
  try {
    const result = reprocessAdminWebhook(id);
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json({ error: "reprocess_failed" }, { status: 422 });
  }
}
