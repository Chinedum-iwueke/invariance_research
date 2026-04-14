import Link from "next/link";
import type { Metadata } from "next";
import { PublicShell } from "@/components/public/public-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HeroOverlayBackground } from "@/components/public/hero-overlay-background";
import { ResearchDeskWaitlistForm } from "@/components/public/research-desk-waitlist-form";
import { ResearchDeskCapabilityStage } from "@/components/public/research-desk-capability-stage";
import { ResearchDeskFlow } from "@/components/public/research-desk-flow";

export const metadata: Metadata = {
  title: "Invariance Research Desk | Coming Soon",
  description: "A coming-soon preview of Invariance Research Desk, an AI-native research operating environment.",
};

export default function ResearchDeskPage() {
  return (
    <PublicShell>
      <main className="bg-surface-white">
        <section className="relative isolate overflow-hidden border-b border-border-subtle/70">
          <HeroOverlayBackground src="/overlay_graphic_2.png" />
          <div className="container-shell relative z-10 py-section-md md:py-section-lg">
            <div className="max-w-3xl space-y-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">COMING SOON</p>
              <h1 className="max-w-[14ch] text-4xl font-semibold tracking-tight text-text-institutional md:text-5xl">Invariance Research Desk</h1>
              <p className="max-w-2xl text-xl text-text-graphite">The AI-native research environment for turning trading ideas into audited, execution-realistic evidence.</p>
              <p className="max-w-3xl text-base leading-relaxed text-text-neutral">
                Invariance Research Desk is a forthcoming product built for traders and researchers who want more than idea generation. It combines AI assistants, structured research agents, and execution-aware validation workflows to help transform market intuition into formal hypotheses, realistic backtests, deeper diagnostics, and clearer deployment decisions.
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <Button asChild>
                  <a href="#waitlist">Join the Waitlist</a>
                </Button>
                <Button asChild variant="secondary">
                  <Link href="/robustness-lab">Explore Robustness Lab</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <ResearchDeskCapabilityStage />

        <ResearchDeskFlow />

        <section className="container-shell py-section-sm">
          <Card className="grid gap-5 border-border-subtle bg-surface-panel/30 p-card-md md:grid-cols-[1fr_auto] md:items-start md:p-card-lg">
            <div className="max-w-3xl space-y-3">
              <h2 className="text-2xl font-semibold text-text-institutional">Why it matters</h2>
              <p className="text-base leading-relaxed text-text-neutral">
                Most strategies do not fail because traders lack ideas. They fail because ideas are formulated too loosely, tested on the wrong assumptions, or judged too shallowly. Research Desk is being built to reduce that gap by combining AI assistance with structured research discipline and execution-aware validation.
              </p>
            </div>
            <aside className="rounded-sm border border-border-subtle bg-surface-white/85 p-4 text-xs uppercase tracking-[0.14em] text-text-neutral">
              Evidence quality compounds.
            </aside>
          </Card>
        </section>

        <section id="waitlist" className="container-shell py-section-md">
          <Card className="space-y-5 border-border-subtle bg-surface-panel/50 p-card-lg">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-text-institutional">Get early access when Research Desk opens</h2>
              <p className="max-w-3xl text-sm text-text-neutral">
                Join the waitlist for launch updates, product previews, and limited early-access invitations as the next generation of Invariance Research takes shape.
              </p>
            </div>
            <ResearchDeskWaitlistForm sourcePage="/research-desk" />
          </Card>
        </section>

        <section className="container-shell pt-2 pb-section-lg">
          <p className="text-sm text-text-neutral">Built on the execution-realistic research foundations behind Invariance Research.</p>
        </section>
      </main>
    </PublicShell>
  );
}
