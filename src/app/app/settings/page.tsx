import type { Metadata } from "next";
import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { requireServerSession } from "@/lib/server/auth/session";

export const metadata: Metadata = {
  title: "Settings",
  description: "Workspace settings and account controls.",
};

export default async function SettingsPage() {
  const session = await requireServerSession();

  return (
    <AnalysisPageFrame title="Settings">
      <div className="grid gap-4 2xl:grid-cols-2">
        <WorkspaceCard title="Profile" subtitle="Identity">
          <p className="text-sm text-text-neutral">Email: {session.email}</p>
          <p className="text-sm text-text-neutral">User ID: {session.user_id}</p>
        </WorkspaceCard>
      </div>
    </AnalysisPageFrame>
  );
}
