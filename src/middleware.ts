import { NextRequest, NextResponse } from "next/server";
import { PREVIEW_GATE_COOKIE_NAME, createPreviewGateToken, previewGateEnabled } from "@/lib/preview-gate";

const PUBLIC_FILE = /\.(.*)$/;

function isBypassedPath(pathname: string) {
  if (pathname === "/coming-soon") return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/images/")) return true;
  if (pathname.startsWith("/assets/")) return true;
  if (pathname.startsWith("/api/preview-gate")) return true;
  if (pathname.startsWith("/api/waitlist")) return true;
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname.startsWith("/api/webhooks/stripe")) return true;
  if (pathname.startsWith("/api/stripe/webhook")) return true;
  if (pathname.startsWith("/api/health")) return true;
  if (pathname.startsWith("/api/debug/tls-check")) return true;
  if (pathname.startsWith("/api/publications/assets")) return true;
  return PUBLIC_FILE.test(pathname);
}

export async function middleware(request: NextRequest) {
  if (!previewGateEnabled() || isBypassedPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(PREVIEW_GATE_COOKIE_NAME)?.value;
  if (token && token === await createPreviewGateToken()) {
    return NextResponse.next();
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = "/coming-soon";
  redirectUrl.search = "";
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  if (nextPath !== "/") redirectUrl.searchParams.set("next", nextPath);
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|favicon-16x16.png|favicon-32x32.png|apple-touch-icon.png|icon.svg).*)"],
};

