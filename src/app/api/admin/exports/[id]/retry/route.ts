import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/server/admin/guards";
import { retryAdminExport } from "@/lib/server/admin/exports-service";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdminSession();
  const { id } = await params;
  try {
    return NextResponse.json(retryAdminExport(id));
  } catch {
    return NextResponse.json({ error: "retry_not_allowed" }, { status: 422 });
  }
}
