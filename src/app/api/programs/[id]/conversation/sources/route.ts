import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/server/auth/session";
import { enforceRateLimit } from "@/lib/server/rate-limits";
import { addProgramYouTubeSource, uploadProgramSource } from "@/lib/server/research-copilot/service";
import type { ResearchSource } from "@/lib/server/research-copilot/models";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const limited = await enforceRateLimit({ request, route: "program_source_upload", kind: "upload", userId: session.user_id, accountId: session.account_id });
  if (limited) return limited;
  const { id } = await params;
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = await request.json() as { url?: string; transcript?: string; title?: string };
      if (!body.url) throw new Error("youtube_url_required");
      const result = await addProgramYouTubeSource({ programId: id, accountId: session.account_id, userId: session.user_id, url: body.url, transcript: body.transcript, title: body.title });
      return NextResponse.json(result, { status: 201 });
    }
    const form = await request.formData();
    const file = form.get("file");
    const pastedText = String(form.get("text") ?? "").trim();
    const title = String(form.get("title") ?? "Research source").trim();
    const sourceType = String(form.get("source_type") ?? "") as ResearchSource["source_type"];
    if (!(file instanceof File) && !pastedText) throw new Error("source_file_or_text_required");
    const bytes = file instanceof File ? new Uint8Array(await file.arrayBuffer()) : new TextEncoder().encode(pastedText);
    const result = await uploadProgramSource({
      programId: id, accountId: session.account_id, userId: session.user_id, title,
      fileName: file instanceof File ? file.name : `${sourceType || "text"}.txt`,
      contentType: file instanceof File ? (file.type || "application/octet-stream") : "text/plain",
      bytes, sourceType: sourceType || (pastedText ? "transcript" : undefined),
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "source_ingestion_failed";
    const status = /not_found/.test(message) ? 404 : /required|invalid|too_large|not_allowed|unavailable|empty|limit|malware|magic|page/.test(message) ? 400 : 500;
    return NextResponse.json({ error: { code: message, message } }, { status });
  }
}
