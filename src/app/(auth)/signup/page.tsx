"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { BrandLogo } from "@/components/ui/logo";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mismatch = useMemo(() => confirmPassword.length > 0 && password !== confirmPassword, [password, confirmPassword]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) { /* unchanged */
    event.preventDefault();
    if (mismatch) return setError("Passwords do not match.");
    setBusy(true); setError(null);
    const signupResponse = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, password, confirm_password: confirmPassword }) });
    const signupPayload = (await signupResponse.json()) as { error?: { message?: string } };
    if (!signupResponse.ok) return void (setError(signupPayload.error?.message ?? "Unable to create account."), setBusy(false));
    const loginResult = await signIn("credentials", { email, password, redirect: false });
    if (loginResult?.error) return void (setError("Account created, but automatic sign-in failed. Please sign in manually."), setBusy(false));
    router.push("/app"); router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-border-subtle bg-surface-white p-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <BrandLogo className="h-12 w-auto" />
          <div><h1 className="text-2xl font-semibold">Create account</h1><p className="mt-1 text-sm text-text-neutral">Start with free diagnostics and request an audit for full validation depth.</p></div>
        </div>
        <button onClick={() => signIn("google", { callbackUrl: "/app" })} className="w-full rounded-lg border border-border-subtle px-4 py-2 text-sm font-medium hover:bg-surface-panel">Continue with Google</button>
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block text-sm">Name<input value={name} onChange={(event) => setName(event.target.value)} name="name" type="text" className="mt-1 w-full rounded-lg border p-2" /></label>
          <label className="block text-sm">Email<input value={email} onChange={(event) => setEmail(event.target.value)} name="email" type="email" required className="mt-1 w-full rounded-lg border p-2" /></label>
          <label className="block text-sm">Password<input value={password} onChange={(event) => setPassword(event.target.value)} name="password" type="password" required minLength={10} className="mt-1 w-full rounded-lg border p-2" /></label>
          <label className="block text-sm">Confirm password<input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} name="confirm_password" type="password" required minLength={10} className="mt-1 w-full rounded-lg border p-2" /></label>
          {mismatch ? <p className="text-xs text-red-600">Passwords do not match.</p> : null}
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          <button disabled={busy || mismatch} className="w-full rounded-lg bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-70">{busy ? "Creating account..." : "Sign up for free"}</button>
        </form>
        <p className="text-sm text-neutral-600">Already have an account? <Link href="/login" className="underline">Sign in</Link></p>
      </div>
    </main>
  );
}
