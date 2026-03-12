import type { ReactNode } from "react";
import { primaryNav, footerGroups } from "@/content/site";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteNavbar } from "@/components/public/site-navbar";

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteNavbar links={primaryNav} />
      {children}
      <SiteFooter groups={footerGroups} />
    </>
  );
}
