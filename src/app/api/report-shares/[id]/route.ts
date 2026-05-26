import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/server/auth/session";
import { revokeReportShare } from "@/lib/server/share/share-service";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const { id } = await params;
  try {
    const share = await revokeReportShare({ share_id: id, account_id: session.account_id });
    return NextResponse.json({ share_id: share?.share_id, status: share?.status, revoked_at: share?.revoked_at });
  } catch (error) {
    const code = error instanceof Error ? error.message : "share_revoke_failed";
    return NextResponse.json({ error: { code, message: "Share link could not be revoked." } }, { status: 404 });
  }
}
