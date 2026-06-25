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

function suggestedTitle(idea: string) {
  const words = idea.trim().split(/\s+/).slice(0, 7).join(" ");
  if (!words) return "";
  return words.length > 72 ? `${words.slice(0, 69)}...` : words;
}

export default async function NewProgramPage({ searchParams }: { searchParams?: Promise<{ idea?: string; source?: string }> }) {
  const resolvedSearchParams = await searchParams;
  const idea = String(resolvedSearchParams?.idea ?? "").trim().slice(0, 2000);
  const openSourceUploader = resolvedSearchParams?.source === "paper";
  async function createProgramAction(formData: FormData) {
    "use server";
    const session = await requireServerSession();
    const program = await createResearchProgram(parseCreateProgramForm(formData, session));
    const wantsSourceUploader = String(formData.get("open_source_uploader") ?? "") === "1";
    redirect(`/app/programs/${program.program_id}${wantsSourceUploader ? "?source=1" : ""}`);
  }

  return (
    <AnalysisPageFrame
      title="Start Research Program"
      description={openSourceUploader ? "Create a research program, then attach the paper, transcript, or source document for hypothesis extraction." : "Create the durable container for a thesis, hypotheses, imports, engine runs, verdicts, memory, and reports."}
    >
      <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <WorkspaceCard title="Program brief" subtitle="State the crypto market idea, where it should work, and what would prove it wrong.">
          <form action={createProgramAction} className="space-y-4">
            <label className="block text-sm font-medium text-text-institutional">
              Program title
              <input
                name="title"
                required
                maxLength={120}
                placeholder="London session breakout validation"
                defaultValue={suggestedTitle(idea)}
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
                defaultValue={idea}
                className="mt-2 w-full rounded-sm border border-border-subtle bg-surface-white px-3 py-2 text-sm leading-6 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
              />
            </label>
            <input type="hidden" name="market" value="crypto" />
            {openSourceUploader ? <input type="hidden" name="open_source_uploader" value="1" /> : null}
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-sm font-medium text-text-institutional">
                Asset universe
                <input name="asset_universe" placeholder="BTCUSDT, ETHUSDT, SOLUSDT" className="mt-2 w-full rounded-sm border border-border-subtle bg-surface-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" />
              </label>
              <label className="block text-sm font-medium text-text-institutional">
                Timeframe
                <input name="timeframe" placeholder="5m, 1h, daily" className="mt-2 w-full rounded-sm border border-border-subtle bg-surface-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" />
              </label>
            </div>
            <p className="rounded-sm border border-border-subtle bg-surface-subtle px-3 py-2 text-xs leading-5 text-text-neutral">
              Market scope: crypto. Bybit and Binance market data are supported for research; exchange deployment is introduced only after connector qualification.
            </p>
            <Button type="submit">{openSourceUploader ? "Create Program and Add Source" : "Create Program"}</Button>
          </form>
        </WorkspaceCard>

        <WorkspaceCard title="What this unlocks" subtitle="One durable record for the idea, experiments, evidence, decisions, and memory.">
          <div className="space-y-3 text-sm leading-6 text-text-neutral">
            {openSourceUploader ? (
              <p><span className="font-medium text-text-institutional">Paper intake:</span> after the program opens, upload a PDF, transcript, Markdown, text file, or screenshot, then ask the assistant to extract testable hypotheses with citations.</p>
            ) : null}
            <p><span className="font-medium text-text-institutional">Research:</span> clarify the intuition, approve the hypothesis and strategy contract, then queue falsification experiments.</p>
            <p><span className="font-medium text-text-institutional">Evidence:</span> attach existing analyses and keep every verdict, limitation, and next test connected to the thesis.</p>
            <p><span className="font-medium text-text-institutional">Guardrail:</span> the app should not invent research context. Missing assumptions stay visible until a user or reviewer supplies them.</p>
          </div>
        </WorkspaceCard>
      </div>
    </AnalysisPageFrame>
  );
}
