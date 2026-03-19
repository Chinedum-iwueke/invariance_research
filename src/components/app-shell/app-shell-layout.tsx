import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { AppTopbar } from "@/components/app-shell/app-topbar";
import { InstitutionalHeader } from "@/components/navigation/institutional-header";
import type { AnalysisContext } from "@/lib/mock/analysis";

interface AppShellLayoutProps {
  children: ReactNode;
  rightRail?: ReactNode;
  context?: AnalysisContext;
}

export function AppShellLayout({ children, rightRail, context }: AppShellLayoutProps) {
  return (
    <div className="min-h-screen bg-surface-white">
      <InstitutionalHeader authenticated />
      <div className="flex">
        <AppSidebar />
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
