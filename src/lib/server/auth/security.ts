export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;

  const requestUrl = new URL(request.url);
  const allowed = new Set([
    requestUrl.origin,
    process.env.APP_URL,
    process.env.NEXTAUTH_URL,
  ].filter(Boolean));

  if (!allowed.has(origin)) {
    throw new Error("invalid_origin");
  }
}
