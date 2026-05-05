"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BrandLogo } from "@/components/ui/logo";

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
        <div className="flex flex-col items-center gap-4 text-center">
          <BrandLogo className="h-12 w-auto" />
          <div>
            <h1 className="text-2xl font-semibold">Sign in</h1>
            <p className="mt-1 text-sm text-text-neutral">Access your validation workspace.</p>
          </div>
        </div>

        <button onClick={() => signIn("google", { callbackUrl: "/app" })} className="w-full rounded-lg border border-border-subtle px-4 py-2 text-sm font-medium hover:bg-surface-panel">
          Continue with Google
        </button>

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
