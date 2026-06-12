# Preview Gate

The public site can be placed behind a lightweight password gate while the product is tested with a small group.

## Environment

Set these in `.env.local` for local testing and in Vercel for the deployed app:

```bash
PREVIEW_GATE_PASSWORD="use-a-strong-shared-password"
PREVIEW_GATE_COOKIE_SECRET="use-a-long-random-cookie-secret"
```

The gate is enabled whenever `PREVIEW_GATE_PASSWORD` is present. To temporarily disable it without deleting the password:

```bash
PREVIEW_GATE_ENABLED=false
```

## Behavior

- Visitors without the preview cookie are redirected to `/coming-soon`.
- Invited testers enter the shared password and receive a 30-day HTTP-only cookie.
- Early-access requests post to the existing `/api/waitlist` endpoint with `sourcePage=preview_gate`.
- Auth callbacks, Stripe webhooks, health checks, static assets, and the waitlist endpoint remain reachable behind the gate.

