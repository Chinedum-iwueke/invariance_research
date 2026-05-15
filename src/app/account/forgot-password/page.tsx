"use client";

import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const payload = await response.json().catch(() => null) as { message?: string } | null;
    setMessage(payload?.message ?? "If an account exists for that email, password reset instructions have been sent.");
    setBusy(false);
  }

  return (
    <main className="public-hero-band flex min-h-screen items-center justify-center px-4 py-10">
      <div className="artifact-surface w-full max-w-md overflow-hidden p-6">
        <div className="-mx-6 -mt-6 mb-6 h-1 bg-brand" />
        <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-brand">Account recovery</p>
        <h1 className="font-display mt-2 text-4xl font-medium leading-none">Reset password</h1>
        <p className="mt-2 text-sm text-text-neutral">Enter your account email and we will send reset instructions if the account exists.</p>
        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <label className="block text-sm">Email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required className="mt-1 min-h-11 w-full rounded-sm border border-border-subtle px-3 py-2" /></label>
          {message ? <p className="text-sm text-text-graphite">{message}</p> : null}
          <button disabled={busy} className="min-h-11 w-full rounded-sm bg-brand px-3 py-2 text-sm font-medium text-white disabled:opacity-70">{busy ? "Sending..." : "Send reset link"}</button>
        </form>
        <Link href="/login" className="mt-4 inline-block text-sm underline">Back to sign in</Link>
      </div>
    </main>
  );
}
