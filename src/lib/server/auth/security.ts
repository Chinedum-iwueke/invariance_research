export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;

  const requestUrl = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? requestUrl.protocol.replace(":", "");
  const allowed = new Set([
    requestUrl.origin,
    host ? `${proto}://${host}` : undefined,
    process.env.APP_URL,
    process.env.NEXTAUTH_URL,
  ].filter(Boolean));

  if (!allowed.has(origin)) {
    throw new Error("invalid_origin");
  }
}
