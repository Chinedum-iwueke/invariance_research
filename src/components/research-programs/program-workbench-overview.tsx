import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { ProgramWorkbenchSummary } from "@/lib/server/research-programs/workbench";

function pretty(value: string | undefined) {
  return value ? value.replace(/_/g, " ") : "not recorded";
}

function CommandButton({ href, label, enabled }: { href: string; label: string; enabled: boolean }) {
  return enabled ? (
    <Link href={href} className={buttonVariants({ size: "sm", variant: "secondary" })}>{label}</Link>
  ) : (
    <span className="rounded-sm border border-border-subtle bg-surface-subtle px-3 py-2 text-sm text-text-neutral opacity-60">{label}</span>
  );
}

export function ProgramWorkbenchOverview({ programId, summary }: { programId: string; summary: ProgramWorkbenchSummary }) {
  const sections = [
    { label: "Hypotheses", href: `/app/programs/${programId}/hypotheses`, detail: `${summary.active_hypotheses} version(s)` },
    { label: "Experiments", href: `/app/programs/${programId}/experiments`, detail: `${summary.queued_or_running_experiments} queued/running` },
    { label: "Runs", href: `/app/programs/${programId}/runs`, detail: `${summary.completed_experiments} completed` },
    { label: "Memory", href: `/app/programs/${programId}/memory`, detail: `${summary.memory_items} item(s)` },
    { label: "Reports", href: `/app/programs/${programId}/reports`, detail: summary.command_states.can_generate_report ? "ready" : "waiting" },
    { label: "Imports", href: `/app/programs/${programId}/imports`, detail: "audit evidence" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="rounded-md border border-border-subtle bg-surface-white p-3 transition hover:border-brand/40 hover:bg-surface-subtle"
          >
            <span className="block text-sm font-medium text-text-institutional">{section.label}</span>
            <span className="mt-1 block text-xs text-text-neutral">{section.detail}</span>
          </Link>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-md border border-border-subtle bg-surface-subtle p-3">
          <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">Hypotheses</p>
          <p className="mt-2 text-2xl font-medium text-text-institutional">{summary.active_hypotheses}</p>
          <p className="mt-1 text-xs text-text-neutral">{summary.approved_hypotheses} approved</p>
        </div>
        <div className="rounded-md border border-border-subtle bg-surface-subtle p-3">
          <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">Strategy specs</p>
          <p className="mt-2 text-2xl font-medium text-text-institutional">{summary.approved_strategy_specs}</p>
          <p className="mt-1 text-xs text-text-neutral">execution approved</p>
        </div>
        <div className="rounded-md border border-border-subtle bg-surface-subtle p-3">
          <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">Experiments</p>
          <p className="mt-2 text-2xl font-medium text-text-institutional">{summary.queued_or_running_experiments}</p>
          <p className="mt-1 text-xs text-text-neutral">queued or running</p>
        </div>
        <div className="rounded-md border border-border-subtle bg-surface-subtle p-3">
          <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">Completed</p>
          <p className="mt-2 text-2xl font-medium text-text-institutional">{summary.completed_experiments}</p>
          <p className="mt-1 text-xs text-text-neutral">experiment jobs</p>
        </div>
        <div className="rounded-md border border-border-subtle bg-surface-subtle p-3">
          <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">Failures</p>
          <p className="mt-2 text-2xl font-medium text-text-institutional">{summary.failed_experiments}</p>
          <p className="mt-1 text-xs text-text-neutral">explainable jobs</p>
        </div>
        <div className="rounded-md border border-border-subtle bg-surface-subtle p-3">
          <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">Memory</p>
          <p className="mt-2 text-2xl font-medium text-text-institutional">{summary.memory_items}</p>
          <p className="mt-1 text-xs text-text-neutral">{summary.findings} finding(s)</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <div className="rounded-md border border-border-subtle bg-surface-white p-4">
          <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">Latest verdict</p>
          {summary.latest_verdict ? (
            <div className="mt-3">
              <p className="text-lg font-medium text-text-institutional">{pretty(summary.latest_verdict.verdict)}</p>
              <p className="mt-2 text-sm leading-6 text-text-neutral">
                Confidence: {pretty(summary.latest_verdict.confidence)}. Decision grade: {summary.latest_verdict.decision_grade ? "yes" : "not yet"}.
                Recommended action: {pretty(summary.latest_verdict.recommended_action)}.
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-text-neutral">No verdict cards recorded yet. Queue an approved experiment to produce the first interpreted result.</p>
          )}
        </div>

        <div className="rounded-md border border-border-subtle bg-surface-white p-4">
          <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">Program commands</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <CommandButton href={`#hypothesis-approval`} label="Create hypothesis" enabled={summary.command_states.can_create_hypothesis} />
            <CommandButton href={`#hypothesis-approval`} label="Queue next experiment" enabled={summary.command_states.can_queue_next_experiment} />
            <CommandButton href={`/app/programs/${programId}/runs`} label="Explain failure" enabled={summary.command_states.can_explain_failure} />
            <CommandButton href={`/app/programs/${programId}/memory`} label="Find similar runs" enabled={summary.command_states.can_find_similar_runs} />
            <CommandButton href={`/app/programs/${programId}/reports`} label="Generate report" enabled={summary.command_states.can_generate_report} />
            <CommandButton href="/contact" label="Request Expert Review" enabled={summary.command_states.can_request_research_desk} />
          </div>
        </div>
      </div>
    </div>
  );
}
