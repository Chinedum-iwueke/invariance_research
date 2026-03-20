import { WorkspaceCard } from "@/components/dashboard/workspace-card";

export function BillingSummaryCard({
  plan,
  status,
  analysesUsed,
  analysesLimit,
  retentionDays,
  unlimitedAnalyses = false,
}: {
  plan: string;
  status: string;
  analysesUsed: number;
  analysesLimit: number;
  retentionDays: number;
  unlimitedAnalyses?: boolean;
}) {
  return (
    <WorkspaceCard title="Billing summary" subtitle="Current subscription posture">
      <div className="grid gap-2 text-sm text-text-neutral md:grid-cols-2">
        <p>Current plan: <span className="font-medium text-text-graphite">{plan}</span></p>
        <p>Subscription status: <span className="font-medium text-text-graphite">{status}</span></p>
        <p>Analyses this month: <span className="font-medium text-text-graphite">{unlimitedAnalyses ? `${analysesUsed} / Unlimited` : `${analysesUsed} / ${analysesLimit}`}</span></p>
        <p>Retention window: <span className="font-medium text-text-graphite">{retentionDays} days</span></p>
      </div>
    </WorkspaceCard>
  );
}
