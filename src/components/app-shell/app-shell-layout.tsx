import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { AppTopbar } from "@/components/app-shell/app-topbar";
import { InstitutionalHeader } from "@/components/navigation/institutional-header";
import type { AnalysisContext } from "@/lib/mock/analysis";
import { requireServerSession } from "@/lib/server/auth/session";
import { isAdminIdentity } from "@/lib/server/admin/guards";
import { signOut } from "@/lib/server/auth/auth";

interface AppShellLayoutProps {
  children: ReactNode;
  rightRail?: ReactNode;
  context?: AnalysisContext;
}

export async function AppShellLayout({ children, rightRail, context }: AppShellLayoutProps) {
  const session = await requireServerSession();
  const isAdmin = isAdminIdentity({ user_id: session.user_id, email: session.email });

  async function logoutAction(formData: FormData) {
    "use server";
    void formData;
    await signOut({ redirect: false });
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-surface-white">
      <InstitutionalHeader authenticated />
      <div className="flex">
        <AppSidebar isAdmin={isAdmin} logoutAction={logoutAction} />
        <div className="min-w-0 flex-1">
          <AppTopbar context={context} />
          <div className="grid min-h-[calc(100vh-7.75rem)] grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px]">
            <main className="min-w-0 px-5 py-10 lg:px-10">{children}</main>
            {rightRail ? <aside className="border-l border-border-subtle bg-surface-panel/35 p-6">{rightRail}</aside> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
