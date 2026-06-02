import Link from "next/link";
import type { Metadata } from "next";
import { PublicShell } from "@/components/public/public-shell";
import { Button } from "@/components/ui/button";
import { HeroOverlayBackground } from "@/components/public/hero-overlay-background";
import { ResearchDeskWaitlistForm } from "@/components/public/research-desk-waitlist-form";
import { ResearchDeskCapabilityStage } from "@/components/public/research-desk-capability-stage";
import { ResearchDeskFlow } from "@/components/public/research-desk-flow";
import { PageTransitionBand } from "@/components/public/validation-page-scenes";

export const metadata: Metadata = {
  title: "Invariance Research Desk | Coming Soon",
  description: "A coming-soon preview of Invariance Research Desk, an AI-native research operating environment.",
};

export default function ResearchDeskPage() {
  return (
    <PublicShell>
      <main className="bg-surface-white">
        <section className="public-hero-band relative isolate overflow-hidden border-b border-border-subtle/70">
          <HeroOverlayBackground src="/overlay_graphic_2.png" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,var(--surface-white)_0%,rgba(251,250,247,0.92)_44%,rgba(251,250,247,0.35)_100%)]" />
          <div className="container-shell relative z-10 grid gap-8 py-section-md md:grid-cols-[minmax(0,0.95fr)_minmax(22rem,0.9fr)] md:items-center md:gap-12 md:py-section-lg">
            <div className="max-w-3xl space-y-4 md:space-y-5">
              <p className="inline-flex border-y border-brand/30 bg-brand/[0.06] px-3 py-2 font-provenance text-[10px] uppercase tracking-[0.14em] text-brand">IR Labs / Coming soon</p>
              <h1 className="font-display max-w-[11.5ch] text-[clamp(3rem,13vw,4.7rem)] font-medium leading-[0.92] text-text-institutional md:text-[clamp(5.2rem,7vw,6.8rem)]">Invariance Research Desk</h1>
              <p className="max-w-2xl text-lg leading-snug text-text-graphite md:text-xl">The operating room for turning trading intuition into audited, execution-realistic evidence.</p>
              <p className="max-w-3xl text-[0.95rem] leading-[1.72] text-text-neutral md:text-base md:leading-relaxed">
                Research Desk helps formalize claims, plan experiments, preserve evidence history, and turn complex validation work into review-ready reports.
              </p>
              <div className="mobile-cta-row pt-1">
                <Button asChild>
                  <a href="#waitlist">Join the Waitlist</a>
                </Button>
                <Button asChild variant="secondary">
                  <Link href="/robustness-lab">Explore Lab</Link>
                </Button>
              </div>
            </div>
            <ResearchDeskHeroConsole />
          </div>
        </section>

        <ResearchDeskCapabilityStage />

        <ResearchDeskFlow />

        <section className="container-shell space-y-6 py-section-sm">
          <PageTransitionBand
            title="Start with an automated validation record."
            body="The Strategy Robustness Lab handles the first pass: trade-history intake, evidence-gated diagnostics, prop evaluation when relevant, stress testing, and report generation. Research Desk extends that work when the evidence needs deeper review."
            href="/robustness-lab"
            label="Start with the Lab"
          />
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["Why it matters", "Ideas usually fail because they are under-specified, over-fit, or judged on friendly assumptions."],
              ["What changes", "The Desk makes hypothesis framing, evidence sufficiency, diagnostics, and follow-up experiments one continuous workflow."],
              ["What users remember", "This is not a chatbot. It is a research system that makes every claim earn its next step."],
            ].map(([title, body]) => (
              <article key={title} className="rounded-md border border-border-subtle bg-surface-paper p-5 shadow-soft">
                <p className="font-provenance text-[10px] uppercase tracking-[0.14em] text-brand">{title}</p>
                <p className="mt-3 text-sm leading-7 text-text-neutral">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="waitlist" className="container-shell py-section-md">
          <div className="artifact-surface space-y-5 bg-surface-panel/50 p-card-lg">
            <div className="space-y-2">
              <p className="font-provenance text-[10px] uppercase tracking-[0.14em] text-brand">Research Desk waitlist</p>
              <h2 className="text-xl font-semibold leading-tight text-text-institutional md:text-2xl">Get early access when Research Desk opens</h2>
              <p className="max-w-3xl text-sm text-text-neutral">
                Join the waitlist for product updates, Research Desk availability, and limited early-access invitations as the next generation of Invariance Research takes shape.
              </p>
            </div>
            <ResearchDeskWaitlistForm sourcePage="/research-desk" />
          </div>
        </section>

        <section className="container-shell pt-2 pb-section-lg">
          <p className="text-sm text-text-neutral">Built on the execution-realistic research foundations behind Invariance Research.</p>
        </section>
      </main>
    </PublicShell>
  );
}

function ResearchDeskHeroConsole() {
  return (
    <div className="grid gap-4">
      <div className="artifact-surface overflow-hidden p-4 shadow-raised">
        <div className="flex items-start justify-between gap-4 border-b border-border-subtle pb-3">
          <div>
            <p className="font-provenance text-[10px] uppercase tracking-[0.14em] text-brand">Research operating room</p>
            <h2 className="mt-1 text-xl font-semibold leading-tight text-text-graphite">Strategy claim: active investigation</h2>
          </div>
          <span className="rounded-full border border-evidence-processing/25 bg-evidence-processing-wash px-2.5 py-1 font-provenance text-[10px] uppercase tracking-[0.1em] text-evidence-processing">
            agent queue
          </span>
        </div>
        <div className="grid gap-3 py-4">
          {[
            ["Assistant", "Clarifies missing assumptions before backtest", "running"],
            ["Research agent", "Proposes next experiment from evidence gaps", "queued"],
            ["Evidence ledger", "Records supported, limited, and locked diagnostics", "active"],
            ["Report artifact", "Packages current claim state for outside review", "ready"],
          ].map(([label, body, state]) => (
            <div key={label} className="rounded-sm border border-border-subtle bg-surface-panel/50 p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">{label}</p>
                <span className="rounded-full border border-border-subtle bg-surface-paper px-2 py-0.5 font-provenance text-[9px] uppercase tracking-[0.1em] text-text-neutral">{state}</span>
              </div>
              <p className="mt-2 text-sm font-semibold leading-snug text-text-graphite">{body}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 border-t border-border-subtle pt-3">
          {[
            ["Claims", "12"],
            ["Experiments", "38"],
            ["Reports", "7"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-sm border border-border-subtle bg-surface-paper px-3 py-2">
              <p className="font-provenance text-2xl leading-none text-text-institutional">{value}</p>
              <p className="mt-1 font-provenance text-[10px] uppercase tracking-[0.1em] text-text-neutral">{label}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-sm border border-border-subtle bg-surface-paper p-3 shadow-soft">
          <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-brand">Memory</p>
          <p className="mt-2 text-sm leading-relaxed text-text-neutral">Previous failures become constraints for the next experiment.</p>
        </div>
        <div className="rounded-sm border border-border-subtle bg-surface-paper p-3 shadow-soft">
          <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-brand">Handoff</p>
          <p className="mt-2 text-sm leading-relaxed text-text-neutral">Lab report demand becomes Research Desk workflow demand.</p>
        </div>
      </div>
    </div>
  );
}
