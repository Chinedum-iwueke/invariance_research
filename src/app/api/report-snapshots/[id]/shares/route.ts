import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/server/auth/session";
import { createReportShare } from "@/lib/server/share/share-service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { expires_at?: string };
  try {
    const created = createReportShare({
      report_snapshot_id: id,
      account_id: session.account_id,
      user_id: session.user_id,
      expires_at: body.expires_at,
    });
    return NextResponse.json({
      share_id: created.share.share_id,
      token: created.token,
      url: created.url,
      expires_at: created.share.expires_at,
    }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "share_create_failed";
    const status = code === "report_snapshot_superseded" ? 409 : 404;
    return NextResponse.json({ error: { code, message: "Share link could not be created." } }, { status });
  }
}
