"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const mismatch = useMemo(() => confirmPassword.length > 0 && password !== confirmPassword, [password, confirmPassword]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mismatch) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    setError(null);

    const signupResponse = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        password,
        confirm_password: confirmPassword,
      }),
    });

    const signupPayload = (await signupResponse.json()) as { error?: { message?: string } };
    if (!signupResponse.ok) {
      setError(signupPayload.error?.message ?? "Unable to create account.");
      setBusy(false);
      return;
    }

    const loginResult = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (loginResult?.error) {
      setError("Account created, but automatic sign-in failed. Please sign in manually.");
      setBusy(false);
      return;
    }

    router.push("/app");
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-md px-6 py-20">
      <h1 className="text-2xl font-semibold">Create account</h1>
      <p className="mt-2 text-sm text-neutral-500">Start with Explorer and upgrade for deeper diagnostics.</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4 rounded-2xl border border-neutral-200 p-6">
        <label className="block text-sm">Name<input value={name} onChange={(event) => setName(event.target.value)} name="name" type="text" className="mt-1 w-full rounded-lg border p-2" /></label>
        <label className="block text-sm">Email<input value={email} onChange={(event) => setEmail(event.target.value)} name="email" type="email" required className="mt-1 w-full rounded-lg border p-2" /></label>
        <label className="block text-sm">Password<input value={password} onChange={(event) => setPassword(event.target.value)} name="password" type="password" required minLength={10} className="mt-1 w-full rounded-lg border p-2" /></label>
        <label className="block text-sm">Confirm password<input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} name="confirm_password" type="password" required minLength={10} className="mt-1 w-full rounded-lg border p-2" /></label>
        {mismatch ? <p className="text-xs text-red-600">Passwords do not match.</p> : null}
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
        <p className="text-xs text-neutral-500">Use at least 10 characters with uppercase, lowercase, and a number.</p>
        <button disabled={busy || mismatch} className="w-full rounded-lg bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-70">{busy ? "Creating account..." : "Create Explorer Account"}</button>
      </form>
      <p className="mt-6 text-sm text-neutral-600">Already have an account? <Link href="/login" className="underline">Sign in</Link></p>
    </main>
  );
}
