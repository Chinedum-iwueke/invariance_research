import Link from "next/link";
import { redirect } from "next/navigation";
import { signIn } from "@/lib/server/auth/auth";

export default function LoginPage() {
  async function login(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");
    if (!email) return;
    await signIn("credentials", { email, redirect: false });
    redirect("/app");
  }

  return (
    <main className="mx-auto max-w-md px-6 py-20">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-2 text-sm text-neutral-500">Access your validation workspace.</p>
      <form action={login} className="mt-8 space-y-4 rounded-2xl border border-neutral-200 p-6">
        <label className="block text-sm">Email<input name="email" type="email" required className="mt-1 w-full rounded-lg border p-2" /></label>
        <button className="w-full rounded-lg bg-neutral-900 px-3 py-2 text-sm text-white">Continue</button>
      </form>
      <p className="mt-6 text-sm text-neutral-600">New to the platform? <Link href="/signup" className="underline">Create account</Link></p>
    </main>
  );
}
