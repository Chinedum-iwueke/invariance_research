import { NextResponse } from "next/server";
import { z } from "zod";
import { PREVIEW_GATE_COOKIE_NAME, createPreviewGateToken, getPreviewGatePassword, previewGateEnabled } from "@/lib/preview-gate";
import { enforceRateLimit } from "@/lib/server/rate-limits";

const previewGateSchema = z.object({
  password: z.string().min(1).max(240),
});

export async function POST(request: Request) {
  const limited = await enforceRateLimit({ request, route: "preview_gate", kind: "auth" });
  if (limited) return limited;

  if (!previewGateEnabled()) {
    return NextResponse.json(
      { error: "preview_gate_not_configured", message: "Preview access is not configured." },
      { status: 503 },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = previewGateSchema.safeParse(json);
  if (!parsed.success || parsed.data.password !== getPreviewGatePassword()) {
    return NextResponse.json(
      { error: "invalid_preview_password", message: "That access password is not valid." },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ ok: true }, { status: 200 });
  response.cookies.set({
    name: PREVIEW_GATE_COOKIE_NAME,
    value: await createPreviewGateToken(parsed.data.password),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true }, { status: 200 });
  response.cookies.set({
    name: PREVIEW_GATE_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

