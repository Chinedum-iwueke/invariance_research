import Link from "next/link";
import type { Metadata } from "next";
import { PublicShell } from "@/components/public/public-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResearchDeskWaitlistForm } from "@/components/public/research-desk-waitlist-form";

export const metadata: Metadata = {
  title: "Invariance Research Desk | Coming Soon",
  description: "A coming-soon preview of Invariance Research Desk, an AI-native research operating environment.",
};

const capabilities = [
  { title: "Strategy Intelligence", body: "Turn vague market intuition into formal, testable hypotheses." },
  { title: "Data Intelligence", body: "Resolve instruments, venues, and data requirements before the test begins." },
  { title: "Execution Intelligence", body: "Stress ideas under realistic fees, slippage, spread, and venue assumptions." },
  { title: "Diagnostic Intelligence", body: "Go beyond PnL into fragility, regime bias, and survivability." },
  { title: "Research Intelligence", body: "Turn isolated runs into a cumulative research program." },
] as const;

const loopSteps = ["Idea", "Clarification", "Formal Hypothesis", "Backtest", "Diagnostics", "Iteration", "Deployment Readiness"] as const;

export default function ResearchDeskPage() {
  return (
    <PublicShell>
      <main className="bg-surface-white">
        <section className="container-shell py-section-md md:py-section-lg">
          <div className="max-w-3xl space-y-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">Coming Soon</p>
            <h1 className="text-4xl font-semibold tracking-tight text-text-institutional md:text-5xl">Invariance Research Desk</h1>
            <p className="text-xl text-text-graphite">From intuition to audited backtest.</p>
            <p className="max-w-2xl text-base leading-relaxed text-text-neutral">
              Invariance Research Desk is a forthcoming AI-native research environment for formalizing market ideas, compiling execution-realistic tests, and diagnosing what survives scrutiny.
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
        </section>

        <section className="container-shell py-section-sm">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((capability) => (
              <Card key={capability.title} className="space-y-2 p-card-md">
                <h2 className="text-base font-semibold text-text-graphite">{capability.title}</h2>
                <p className="text-sm text-text-neutral">{capability.body}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="container-shell py-section-sm">
          <Card className="overflow-hidden border-border-subtle bg-surface-panel/45 p-card-md">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-text-neutral">
              {loopSteps.map((step, index) => (
                <div key={step} className="flex items-center gap-2">
                  <span className="text-text-graphite">{step}</span>
                  {index < loopSteps.length - 1 ? <span className="text-brand/80">→</span> : null}
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section id="waitlist" className="container-shell py-section-md">
          <Card className="space-y-5 border-border-subtle bg-surface-panel/50 p-card-lg">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-text-institutional">Get early access when Research Desk opens.</h2>
              <p className="text-sm text-text-neutral">Join the waitlist for launch updates, product previews, and limited early-access invitations.</p>
            </div>
            <ResearchDeskWaitlistForm sourcePage="/research-desk" />
          </Card>
        </section>

        <section className="container-shell pt-2 pb-section-lg">
          <p className="text-sm text-text-neutral">Built on the execution-realistic validation foundations of Invariance Research.</p>
        </section>
      </main>
    </PublicShell>
  );
}
