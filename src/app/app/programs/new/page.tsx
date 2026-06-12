import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { Button } from "@/components/ui/button";
import { requireServerSession } from "@/lib/server/auth/session";
import { createResearchProgram, parseCreateProgramForm } from "@/lib/server/research-programs/service";

export const metadata: Metadata = {
  title: "Start Research Program",
  description: "Create a thesis-led research program.",
};

export default function NewProgramPage() {
  async function createProgramAction(formData: FormData) {
    "use server";
    const session = await requireServerSession();
    const program = await createResearchProgram(parseCreateProgramForm(formData, session));
    redirect(`/app/programs/${program.program_id}`);
  }

  return (
    <AnalysisPageFrame
      title="Start Research Program"
      description="Create the durable container for a thesis, hypotheses, imports, engine runs, verdicts, memory, and reports."
    >
      <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <WorkspaceCard title="Program brief" subtitle="Keep it falsifiable. The assistant and experiment planner will come later; this form establishes the research object now.">
          <form action={createProgramAction} className="space-y-4">
            <label className="block text-sm font-medium text-text-institutional">
              Program title
              <input
                name="title"
                required
                maxLength={120}
                placeholder="London session breakout validation"
                className="mt-2 w-full rounded-sm border border-border-subtle bg-surface-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
              />
            </label>
            <label className="block text-sm font-medium text-text-institutional">
              Thesis
              <textarea
                name="thesis"
                required
                minLength={20}
                rows={6}
                placeholder="Describe the market intuition you want to test, what should make it work, and what would make it fail."
                className="mt-2 w-full rounded-sm border border-border-subtle bg-surface-white px-3 py-2 text-sm leading-6 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
              />
            </label>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="block text-sm font-medium text-text-institutional">
                Market
                <input name="market" placeholder="FX, crypto, equities" className="mt-2 w-full rounded-sm border border-border-subtle bg-surface-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" />
              </label>
              <label className="block text-sm font-medium text-text-institutional">
                Asset universe
                <input name="asset_universe" placeholder="EURUSD, BTC, NQ" className="mt-2 w-full rounded-sm border border-border-subtle bg-surface-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" />
              </label>
              <label className="block text-sm font-medium text-text-institutional">
                Timeframe
                <input name="timeframe" placeholder="5m, 1h, daily" className="mt-2 w-full rounded-sm border border-border-subtle bg-surface-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" />
              </label>
            </div>
            <Button type="submit">Create Program</Button>
          </form>
        </WorkspaceCard>

        <WorkspaceCard title="What this unlocks" subtitle="B1 creates the container; later phases fill the pipeline actors.">
          <div className="space-y-3 text-sm leading-6 text-text-neutral">
            <p><span className="font-medium text-text-institutional">Now:</span> attach existing analyses, preserve timeline events, and treat uploads as evidence inside a thesis.</p>
            <p><span className="font-medium text-text-institutional">Next:</span> idea intake, clarification, hypothesis specs, strategy specs, experiment queue, verdict cards, and program memory.</p>
            <p><span className="font-medium text-text-institutional">Guardrail:</span> the app should not invent research context. Missing assumptions stay visible until a user or reviewer supplies them.</p>
          </div>
        </WorkspaceCard>
      </div>
    </AnalysisPageFrame>
  );
}
