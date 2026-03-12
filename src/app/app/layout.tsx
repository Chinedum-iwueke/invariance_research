import type { ReactNode } from "react";
import { AppShellLayout } from "@/components/app-shell/app-shell-layout";

export default function ProductShellLayout({ children }: { children: ReactNode }) {
  return <AppShellLayout>{children}</AppShellLayout>;
}
