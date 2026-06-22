"use client";

import Link from "next/link";
import { ArrowRight, FileUp, FlaskConical, History, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type RecentProgram = {
  program_id: string;
  title: string;
  thesis: string;
  next_action: string;
};

const examples = [
  "Test whether BTC funding extremes predict short-term reversals",
  "Research an ETH breakout that only trades after volatility compression",
  "Challenge a SOL trend strategy under doubled fees and slippage",
];

function authenticatedPath(path: string, authenticated: boolean) {
  if (authenticated) return path;
  return `/login?callbackUrl=${encodeURIComponent(path)}`;
}

export function ResearchStartComposer({ authenticated, recentPrograms }: { authenticated: boolean; recentPrograms: RecentProgram[] }) {
  const [idea, setIdea] = useState("");
  const router = useRouter();

  function startResearch() {
    const normalized = idea.trim();
    if (normalized.length < 10) return;
    const path = `/app/programs/new?idea=${encodeURIComponent(normalized)}`;
    router.push(authenticatedPath(path, authenticated));
  }

  const importPath = authenticatedPath("/app/new-analysis", authenticated);

  return (
    <main className="min-h-[calc(100svh-5rem)] bg-surface-white">
      <section className="container-shell flex min-h-[72svh] flex-col justify-center py-12 sm:py-16 lg:py-20">
        <div className="mx-auto w-full max-w-4xl">
          <div className="mb-7 text-center">
            <p className="font-provenance text-[10px] uppercase tracking-[0.14em] text-brand">Invariance Research Desk</p>
            <h1 className="font-display mx-auto mt-3 max-w-[15ch] text-5xl font-medium leading-[0.96] text-text-institutional sm:text-6xl lg:text-7xl">
              What crypto strategy are you trying to test?
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-text-neutral sm:text-base">
              Start with the idea in plain language. Research Desk turns it into a testable program, exposes missing assumptions, and prepares the first governed experiment.
            </p>
          </div>

          <div className="artifact-surface overflow-hidden border-border-strong bg-surface-paper shadow-raised">
            <textarea
              value={idea}
              onChange={(event) => setIdea(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") startResearch();
              }}
              rows={5}
              maxLength={2000}
              placeholder="Describe what you think happens, where it should work, and what would prove you wrong."
              aria-label="Crypto strategy research idea"
              className="w-full resize-none border-0 bg-transparent px-5 py-5 text-base leading-7 text-text-institutional outline-none placeholder:text-text-muted focus:ring-0 sm:px-6 sm:py-6"
            />
            <div className="flex flex-col gap-3 border-t border-border-subtle bg-surface-subtle px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <Link href={importPath} className={buttonVariants({ size: "sm", variant: "tertiary", className: "gap-2" })}>
                <FileUp className="h-4 w-4" /> Import existing evidence
              </Link>
              <button
                type="button"
                onClick={startResearch}
                disabled={idea.trim().length < 10}
                className={cn(buttonVariants({ size: "sm", className: "gap-2" }), "disabled:cursor-not-allowed disabled:opacity-45")}
              >
                Start research <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {examples.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setIdea(example)}
                className="max-w-full rounded-sm border border-border-subtle bg-surface-white px-3 py-2 text-left text-xs leading-5 text-text-neutral transition-colors hover:border-brand/35 hover:bg-brand/5 hover:text-text-institutional"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-border-subtle bg-surface-subtle">
        <div className="container-shell grid gap-px py-0 md:grid-cols-3">
          {[
            { icon: FlaskConical, label: "Formalize", body: "Turn intuition into an explicit hypothesis and strategy contract." },
            { icon: ShieldCheck, label: "Falsify", body: "Run baseline, cost, slippage, holdout, and null experiments." },
            { icon: History, label: "Remember", body: "Keep verdicts, failures, evidence, and next tests attached to the program." },
          ].map((item) => (
            <div key={item.label} className="border-border-subtle px-5 py-6 md:border-r md:last:border-r-0 lg:px-8">
              <item.icon className="h-4 w-4 text-brand" />
              <p className="mt-3 text-sm font-semibold text-text-institutional">{item.label}</p>
              <p className="mt-1 text-sm leading-6 text-text-neutral">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {authenticated && recentPrograms.length > 0 ? (
        <section className="container-shell py-10 lg:py-14">
          <div className="mx-auto max-w-5xl">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-provenance text-[10px] uppercase tracking-[0.14em] text-text-neutral">Continue research</p>
                <h2 className="mt-2 text-xl font-semibold text-text-institutional">Recent programs</h2>
              </div>
              <Link href="/app/programs" className="text-sm font-medium text-brand">View all</Link>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {recentPrograms.slice(0, 3).map((program) => (
                <Link key={program.program_id} href={`/app/programs/${program.program_id}`} className="artifact-surface group min-w-0 p-4 transition hover:border-brand/35 hover:shadow-raised">
                  <p className="truncate text-sm font-semibold text-text-institutional">{program.title}</p>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-text-neutral">{program.thesis}</p>
                  <p className="mt-4 line-clamp-2 border-t border-border-subtle pt-3 text-xs leading-5 text-text-neutral">Next: {program.next_action}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
