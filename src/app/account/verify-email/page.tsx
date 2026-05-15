import Link from "next/link";
import { accountService } from "@/lib/server/accounts/service";

export const dynamic = "force-dynamic";

async function resendVerificationAction(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (email) {
    await accountService.resendVerificationEmail({ email });
  }
}

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const result = token ? await accountService.verifyEmailToken(token) : { ok: false as const };

  return (
    <main className="public-hero-band flex min-h-screen items-center justify-center px-4 py-10">
      <div className="artifact-surface w-full max-w-md overflow-hidden p-6">
        <div className="-mx-6 -mt-6 mb-6 h-1 bg-brand" />
        <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-brand">Workspace verification</p>
        <h1 className="font-display mt-2 text-4xl font-medium leading-none">{result.ok ? "Email verified" : "Verification link expired"}</h1>
        <p className="mt-3 text-sm text-text-neutral">
          {result.ok
            ? "Your account is ready. You can now sign in and access the Strategy Robustness Lab."
            : "This verification link is invalid or expired. Request a fresh link with the same email address."}
        </p>
        {result.ok ? (
          <Link href="/login" className="mt-5 inline-flex min-h-10 items-center justify-center rounded-sm bg-brand px-4 py-2 text-sm font-medium text-white">
            Sign in
          </Link>
        ) : (
          <form action={resendVerificationAction} className="mt-5 space-y-3">
            <input name="email" type="email" required placeholder="Email address" className="min-h-11 w-full rounded-sm border border-border-subtle px-3 py-2 text-sm" />
            <button className="min-h-10 w-full rounded-sm bg-brand px-4 py-2 text-sm font-medium text-white">Resend verification email</button>
          </form>
        )}
      </div>
    </main>
  );
}
