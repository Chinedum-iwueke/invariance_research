import type { Metadata } from "next";
import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";

export const metadata: Metadata = {
  title: "Settings",
  description: "Workspace settings shell.",
};

export default function SettingsPage() {
  return (
    <AnalysisPageFrame title="Settings" description="Profile, access tier, and workspace preferences.">
      <div className="grid gap-4 xl:grid-cols-2">
        <WorkspaceCard title="Profile" subtitle="User shell">
          <p className="text-sm text-text-neutral">Name, role, organization, and account metadata will be wired with auth in Phase 6.</p>
        </WorkspaceCard>
        <WorkspaceCard title="Plan & Access" subtitle="Current tier">
          <p className="text-sm text-text-neutral">Tier: Research Essentials. Advanced diagnostics are available via upgrade.</p>
        </WorkspaceCard>
        <WorkspaceCard title="Billing" subtitle="Placeholder">
          <p className="text-sm text-text-neutral">Billing controls will be introduced with product gating and subscriptions.</p>
        </WorkspaceCard>
        <WorkspaceCard title="Notifications" subtitle="Placeholder">
          <p className="text-sm text-text-neutral">Configure analysis completion and risk-alert notifications in a future phase.</p>
        </WorkspaceCard>
        <WorkspaceCard title="Data and privacy" subtitle="Institutional standards">
          <p className="text-sm text-text-neutral">Data retention, export policy, and confidentiality controls are managed under strict research governance conventions.</p>
        </WorkspaceCard>
        <WorkspaceCard title="Support" subtitle="Contact">
          <p className="text-sm text-text-neutral">Need help with validation scope? Contact support or request professional audit assistance.</p>
        </WorkspaceCard>
      </div>
    </AnalysisPageFrame>
  );
}
