import type { ReactNode } from "react";
import { footerGroups } from "@/content/site";
import { InstitutionalHeader } from "@/components/navigation/institutional-header";
import { SiteFooter } from "@/components/public/site-footer";

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <>
      <InstitutionalHeader />
      {children}
      <SiteFooter groups={footerGroups} />
    </>
  );
}
