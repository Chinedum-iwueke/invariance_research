"use client";

import { signOut } from "next-auth/react";
import { useEffect } from "react";

export default function LogoutPage() {
  useEffect(() => {
    void signOut({ callbackUrl: "/", redirect: true });
  }, []);

  return (
    <main className="public-hero-band flex min-h-screen items-center justify-center px-6 py-10">
      <div className="artifact-surface w-full max-w-md overflow-hidden p-8 text-center">
        <div className="-mx-8 -mt-8 mb-6 h-1 bg-brand" />
        <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-brand">Session closure</p>
        <h1 className="font-display mt-2 text-4xl font-medium leading-none text-text-institutional">Signing out</h1>
        <p className="mt-2 text-sm text-text-neutral">Clearing your session...</p>
      </div>
    </main>
  );
}
