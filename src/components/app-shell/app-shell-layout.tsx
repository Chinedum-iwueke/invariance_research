import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { AppTopbar } from "@/components/app-shell/app-topbar";
import type { AnalysisContext } from "@/lib/mock/analysis";

interface AppShellLayoutProps {
  children: ReactNode;
  rightRail?: ReactNode;
  context?: AnalysisContext;
}

export function AppShellLayout({ children, rightRail, context }: AppShellLayoutProps) {
  return (
    <div className="min-h-screen bg-surface-white">
      <div className="flex">
        <AppSidebar />
        <div className="min-w-0 flex-1">
          <AppTopbar context={context} />
          <div className="grid min-h-[calc(100vh-68px)] grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px]">
            <main className="min-w-0 px-4 py-8 lg:px-8">{children}</main>
            {rightRail ? <aside className="border-l bg-surface-panel/30 p-5">{rightRail}</aside> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
