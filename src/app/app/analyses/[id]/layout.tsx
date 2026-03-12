import type { ReactNode } from "react";
import { AppShellLayout } from "@/components/app-shell/app-shell-layout";
import { AnalysisInsightRail } from "@/components/dashboard/analysis-insight-rail";
import { getAnalysisContext } from "@/lib/mock/analysis";

export default async function AnalysisDetailLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = getAnalysisContext(id);

  return (
    <AppShellLayout context={context} rightRail={<AnalysisInsightRail />}>
      {children}
    </AppShellLayout>
  );
}
