import Link from "next/link";
import { redirect } from "next/navigation";
import { signIn } from "@/lib/server/auth/auth";

export default function SignupPage() {
  async function signup(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");
    const name = String(formData.get("name") ?? "");
    if (!email) return;
    await signIn("credentials", { email, name, redirect: false });
    redirect("/app");
  }

  return (
    <main className="mx-auto max-w-md px-6 py-20">
      <h1 className="text-2xl font-semibold">Create account</h1>
      <p className="mt-2 text-sm text-neutral-500">Start with Explorer and upgrade for deeper diagnostics.</p>
      <form action={signup} className="mt-8 space-y-4 rounded-2xl border border-neutral-200 p-6">
        <label className="block text-sm">Name<input name="name" type="text" className="mt-1 w-full rounded-lg border p-2" /></label>
        <label className="block text-sm">Email<input name="email" type="email" required className="mt-1 w-full rounded-lg border p-2" /></label>
        <button className="w-full rounded-lg bg-neutral-900 px-3 py-2 text-sm text-white">Create Explorer Account</button>
      </form>
      <p className="mt-6 text-sm text-neutral-600">Already have an account? <Link href="/login" className="underline">Sign in</Link></p>
    </main>
  );
}
