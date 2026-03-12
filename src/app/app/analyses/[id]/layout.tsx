import type { ReactNode } from "react";
import { AppShellLayout } from "@/components/app-shell/app-shell-layout";
import { InsightRail } from "@/components/dashboard/insight-rail";
import { getAnalysisContext, overviewDiagnostic } from "@/lib/mock/analysis";

export default async function AnalysisDetailLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = getAnalysisContext(id);

  return (
    <AppShellLayout
      context={context}
      rightRail={<InsightRail insights={overviewDiagnostic.interpretation_points} />}
    >
      {children}
    </AppShellLayout>
  );
}
