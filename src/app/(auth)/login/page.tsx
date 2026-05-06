"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogoMonogram } from "@/components/ui/logo";

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.29h6.45a5.5 5.5 0 0 1-2.39 3.61v3h3.87c2.27-2.09 3.56-5.17 3.56-8.63Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.93-2.9l-3.87-3A7.2 7.2 0 0 1 12 19.27a7.14 7.14 0 0 1-6.7-4.93H1.3v3.09A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC04" d="M5.3 14.34A7.2 7.2 0 0 1 4.92 12c0-.81.14-1.59.38-2.34V6.57H1.3A12 12 0 0 0 0 12c0 1.93.46 3.76 1.3 5.43l4-3.09Z" />
      <path fill="#EA4335" d="M12 4.73c1.77 0 3.35.61 4.6 1.81l3.45-3.45C17.95 1.17 15.24 0 12 0A12 12 0 0 0 1.3 6.57l4 3.09A7.14 7.14 0 0 1 12 4.73Z" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await signIn("credentials", { email, password, redirect: false });
    if (result?.error) {
      setError("Invalid email or password.");
      setBusy(false);
      return;
    }
    router.push("/app");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-border-subtle bg-surface-white p-8">
        <div className="flex flex-col items-center gap-5 text-center">
          <LogoMonogram className="h-14 w-auto md:h-16" priority />
          <div>
            <h1 className="text-2xl font-semibold">Sign in</h1>
            <p className="mt-1 text-sm text-text-neutral">Access your validation workspace.</p>
          </div>
        </div>

        <button
          onClick={() => signIn("google", { callbackUrl: "/app" })}
          className="inline-flex w-full items-center justify-center gap-2.5 rounded-lg border border-border-subtle bg-white px-4 py-2.5 text-sm font-medium text-text-strong transition hover:border-neutral-300 hover:shadow-sm"
        >
          <GoogleMark />
          <span>Continue with Google</span>
        </button>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border-subtle" />
          <span className="text-xs uppercase tracking-[0.14em] text-text-muted">or</span>
          <div className="h-px flex-1 bg-border-subtle" />
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block text-sm">Email<input value={email} onChange={(event) => setEmail(event.target.value)} name="email" type="email" required className="mt-1 w-full rounded-lg border p-2" /></label>
          <label className="block text-sm">Password<input value={password} onChange={(event) => setPassword(event.target.value)} name="password" type="password" required className="mt-1 w-full rounded-lg border p-2" /></label>
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          <button disabled={busy} className="w-full rounded-lg bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-70">{busy ? "Signing in..." : "Continue"}</button>
        </form>
        <p className="text-sm text-neutral-600">New to the platform? <Link href="/signup" className="underline">Create account</Link></p>
      </div>
    </main>
  );
}
