import { NextResponse } from "next/server";
import { resolveSharedReport } from "@/lib/server/share/share-service";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = resolveSharedReport({
    token,
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: request.headers.get("user-agent"),
  });
  if (!result.view) {
    const status = result.status === "not_found" ? 404 : result.status === "expired" ? 410 : result.status === "revoked" ? 410 : 409;
    return NextResponse.json({ error: { code: result.status, message: "Shared report is not available." } }, { status });
  }
  return NextResponse.json({ report: result.view });
}
