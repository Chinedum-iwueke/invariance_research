import { ResetPasswordForm } from "@/app/account/reset-password/reset-password-form";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;

  return (
    <main className="public-hero-band flex min-h-screen items-center justify-center px-4 py-10">
      <div className="artifact-surface w-full max-w-md overflow-hidden p-6">
        <div className="-mx-6 -mt-6 mb-6 h-1 bg-brand" />
        <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-brand">Account recovery</p>
        <h1 className="font-display mt-2 text-4xl font-medium leading-none">Choose a new password</h1>
        <ResetPasswordForm token={token} />
      </div>
    </main>
  );
}
