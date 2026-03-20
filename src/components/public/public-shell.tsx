import type { ReactNode } from "react";
import { footerGroups } from "@/content/site";
import { InstitutionalHeader } from "@/components/navigation/institutional-header";
import { SiteFooter } from "@/components/public/site-footer";
import { getServerSession } from "@/lib/server/auth/session";

export async function PublicShell({ children }: { children: ReactNode }) {
  const session = await getServerSession();
  return (
    <>
      <InstitutionalHeader authenticated={Boolean(session?.user)} />
      {children}
      <SiteFooter groups={footerGroups} />
    </>
  );
}
