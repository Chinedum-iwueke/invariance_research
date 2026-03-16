import type { ReactNode } from "react";
import { AppShellLayout } from "@/components/app-shell/app-shell-layout";
import { requireAppSessionOrRedirect } from "@/lib/server/auth/guards";

export default async function ProductShellLayout({ children }: { children: ReactNode }) {
  await requireAppSessionOrRedirect();
  return <AppShellLayout>{children}</AppShellLayout>;
}
