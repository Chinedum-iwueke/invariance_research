"use client";

import Link from "next/link";
import { useState } from "react";

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password, confirm_password: confirmPassword }),
    });
    const payload = await response.json().catch(() => null) as { message?: string; error?: { message?: string } } | null;
    if (!response.ok) {
      setError(payload?.error?.message ?? "Unable to reset password.");
      setBusy(false);
      return;
    }
    setMessage(payload?.message ?? "Your password has been updated. Please sign in again.");
    setBusy(false);
  }

  return (
    <form onSubmit={onSubmit} className="mt-5 space-y-4">
      <label className="block text-sm">New password<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required minLength={10} className="mt-1 min-h-11 w-full rounded-sm border border-border-subtle px-3 py-2" /></label>
      <label className="block text-sm">Confirm password<input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} type="password" required minLength={10} className="mt-1 min-h-11 w-full rounded-sm border border-border-subtle px-3 py-2" /></label>
      {error ? <p className="text-sm text-brand">{error}</p> : null}
      {message ? <p className="text-sm text-text-graphite">{message}</p> : null}
      <button disabled={busy || Boolean(message)} className="min-h-11 w-full rounded-sm bg-brand px-3 py-2 text-sm font-medium text-white disabled:opacity-70">{busy ? "Updating..." : "Update password"}</button>
      <Link href="/login" className="inline-block text-sm underline">Back to sign in</Link>
    </form>
  );
}
