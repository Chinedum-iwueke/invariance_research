import { NextResponse } from "next/server";
import { z } from "zod";
import { createWaitlistEntry } from "@/lib/server/waitlist/repository";
import { enforceRateLimit } from "@/lib/server/rate-limits";

const waitlistSubmissionSchema = z.object({
  email: z.string().trim().email(),
  name: z.string().trim().max(120).optional(),
  sourcePage: z.string().trim().min(1).max(180),
  roleOrTeam: z.string().trim().max(120).optional(),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = waitlistSubmissionSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload", message: "Please enter a valid email and try again." }, { status: 400 });
  }
  const limited = await enforceRateLimit({ request, route: "waitlist", kind: "waitlist", email: parsed.data.email });
  if (limited) return limited;

  let created: Awaited<ReturnType<typeof createWaitlistEntry>>;
  try {
    created = await createWaitlistEntry(parsed.data);
  } catch {
    return NextResponse.json(
      { error: "waitlist_unavailable", message: "Unable to join the waitlist right now. Please retry shortly." },
      { status: 503 },
    );
  }

  if (created.duplicate) {
    return NextResponse.json(
      {
        ok: true,
        duplicate: true,
        message: "You're already on the waitlist for this release. We'll keep you updated.",
      },
      { status: 200 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      duplicate: false,
      message: "Thank you. You are on the Research Desk waitlist.",
    },
    { status: 201 },
  );
}
