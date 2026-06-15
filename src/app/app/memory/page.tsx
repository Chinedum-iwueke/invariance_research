import type { Metadata } from "next";
import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { ResearchMemoryPanel } from "@/components/research-programs/research-memory-panel";
import { requireServerSession } from "@/lib/server/auth/session";
import { emptyResearchMemorySnapshot, listResearchMemory, searchResearchMemory } from "@/lib/server/research-memory/service";

export const metadata: Metadata = {
  title: "Research Memory",
  description: "Tenant-scoped research memory.",
};

export default async function ResearchMemoryPage({ searchParams }: { searchParams?: Promise<{ q?: string }> }) {
  const session = await requireServerSession();
  const params = await searchParams;
  const query = params?.q?.trim() ?? "";
  const memory = await listResearchMemory(session.account_id).catch(() => emptyResearchMemorySnapshot());
  const searchResults = query ? await searchResearchMemory(session.account_id, query).catch(() => []) : [];

  return (
    <AnalysisPageFrame
      title="Research Memory"
      description="Tenant-scoped memory for verdicts, failures, findings, recommendations, and similar experiment signatures."
    >
      <WorkspaceCard title="Memory contract" subtitle="Every remembered item points back to a program, experiment job, verdict card, or stored artifact. No cross-account recall is enabled.">
        <div className="space-y-3 text-sm leading-6 text-text-neutral">
          <p><span className="font-medium text-text-institutional">Tenant scoped:</span> memory is isolated to this account unless an explicit future sharing contract exists.</p>
          <p><span className="font-medium text-text-institutional">Evidence linked:</span> every remembered finding must cite the experiment event or verdict card that produced it.</p>
          <p><span className="font-medium text-text-institutional">No unsupported recall:</span> memory can retrieve prior failures and next tests, but it cannot invent missing market context.</p>
        </div>
      </WorkspaceCard>
      <WorkspaceCard title="Account memory" subtitle="Latest remembered cards, findings, recommendations, and similarity signatures across your research programs.">
        <form className="mb-5 grid gap-2 sm:grid-cols-[1fr_auto]">
          <input
            name="q"
            defaultValue={query}
            placeholder="Search verdicts, failures, next experiments, tags..."
            className="rounded-sm border border-border-subtle bg-surface-white px-3 py-2 text-sm text-text-institutional outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
          />
          <button type="submit" className="rounded-sm bg-brand px-4 py-2 text-sm font-medium text-white">Search Memory</button>
        </form>
        {query ? (
          <div className="mb-5 rounded-md border border-border-subtle bg-surface-subtle p-4">
            <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">Search results for {query}</p>
            {searchResults.length === 0 ? (
              <p className="mt-2 text-sm text-text-neutral">No remembered item in this account matched that query.</p>
            ) : (
              <div className="mt-3 grid gap-3 xl:grid-cols-2">
                {searchResults.map((item) => (
                  <div key={item.memory_item_id} className="rounded-md border border-border-subtle bg-surface-white p-3">
                    <p className="text-sm font-medium text-text-institutional">{item.title}</p>
                    <p className="mt-2 text-xs leading-5 text-text-neutral">{item.summary}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
        <ResearchMemoryPanel memory={memory} />
      </WorkspaceCard>
    </AnalysisPageFrame>
  );
}
