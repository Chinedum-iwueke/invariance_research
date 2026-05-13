"use client";

import { signOut } from "next-auth/react";
import { useEffect } from "react";

export default function LogoutPage() {
  useEffect(() => {
    void signOut({ callbackUrl: "/", redirect: true });
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="w-full max-w-md rounded-sm border border-border-subtle bg-surface-white p-8 text-center">
        <h1 className="text-xl font-semibold text-text-institutional">Signing out</h1>
        <p className="mt-2 text-sm text-text-neutral">Clearing your session...</p>
      </div>
    </main>
  );
}
