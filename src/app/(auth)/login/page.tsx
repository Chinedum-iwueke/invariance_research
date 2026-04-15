"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

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

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid email or password.");
      setBusy(false);
      return;
    }

    router.push("/app");
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-md px-6 py-20">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-2 text-sm text-neutral-500">Access your validation workspace.</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4 rounded-2xl border border-neutral-200 p-6">
        <label className="block text-sm">Email<input value={email} onChange={(event) => setEmail(event.target.value)} name="email" type="email" required className="mt-1 w-full rounded-lg border p-2" /></label>
        <label className="block text-sm">Password<input value={password} onChange={(event) => setPassword(event.target.value)} name="password" type="password" required className="mt-1 w-full rounded-lg border p-2" /></label>
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
        <button disabled={busy} className="w-full rounded-lg bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-70">{busy ? "Signing in..." : "Continue"}</button>
      </form>
      <p className="mt-6 text-sm text-neutral-600">New to the platform? <Link href="/signup" className="underline">Create account</Link></p>
    </main>
  );
}
