import type { Metadata } from "next";
import Link from "next/link";
import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { requireServerSession } from "@/lib/server/auth/session";
import { getCoreRepositories } from "@/lib/server/persistence/repositories";

export const metadata: Metadata = {
  title: "Settings",
  description: "Workspace settings and account controls.",
};

export default async function SettingsPage() {
  const session = await requireServerSession();
  const user = await getCoreRepositories().users.findById(session.user_id);

  return (
    <AnalysisPageFrame title="Settings">
      <div className="grid gap-4 2xl:grid-cols-2">
        <WorkspaceCard title="Account" subtitle="Identity and access">
          <p className="text-sm text-text-neutral">Email: {session.email}</p>
          <p className="text-sm text-text-neutral">Email status: {user?.email_verified_at ? "Verified" : "Unverified"}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/account/forgot-password" className="rounded-sm border border-border-subtle px-3 py-2 text-sm hover:bg-surface-panel">
              Reset password
            </Link>
          </div>
        </WorkspaceCard>
      </div>
    </AnalysisPageFrame>
  );
}
