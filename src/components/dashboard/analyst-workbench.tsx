import { FileCheck2, FileWarning, ShieldQuestion, Workflow } from "lucide-react";
import { EvidenceStatusBadge } from "@/components/dashboard/evidence-status";
import type { AnalystWorkbenchModel } from "@/lib/app/analyst-workbench";

function ListBlock({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="rounded-md border border-border-subtle bg-surface-subtle p-4">
      <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">{title}</p>
      {items.length ? (
        <ul className="mt-3 space-y-2 text-sm leading-6 text-text-neutral">
          {items.map((item, index) => <li key={`${title}-${index}-${item.slice(0, 24)}`}>- {item}</li>)}
        </ul>
      ) : (
        <p className="mt-3 text-sm leading-6 text-text-neutral">{empty}</p>
      )}
    </div>
  );
}

export function AnalystWorkbenchPanel({ model }: { model: AnalystWorkbenchModel }) {
  return (
    <section className="artifact-surface overflow-hidden rounded-md border border-border-subtle bg-surface-white shadow-sm">
      <div className="grid gap-4 border-b border-border-subtle bg-surface-subtle px-5 py-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-provenance text-[10px] uppercase tracking-[0.14em] text-research-red">Analyst workbench / {model.title}</p>
            <EvidenceStatusBadge state={model.evidenceState} label={model.evidenceLabel} compact />
          </div>
          <div className="mt-4 flex gap-3">
            <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-research-red/20 bg-research-red/5 text-research-red">
              <ShieldQuestion className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-display text-[clamp(1.6rem,3vw,2.4rem)] font-medium leading-none text-text-institutional">{model.attackQuestion}</h2>
              <p className="mt-3 max-w-5xl text-sm leading-7 text-text-neutral">{model.attackAnswer}</p>
            </div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-border-subtle bg-surface-paper p-4">
            <FileCheck2 className="h-4 w-4 text-research-red" />
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.1em] text-text-neutral">Verdict posture</p>
            <p className="mt-1 text-sm font-medium text-text-institutional">{model.verdictLabel}</p>
          </div>
          <div className="rounded-md border border-border-subtle bg-surface-paper p-4">
            <Workflow className="h-4 w-4 text-research-red" />
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.1em] text-text-neutral">Plan state</p>
            <p className="mt-1 text-sm font-medium text-text-institutional">{model.planState}</p>
          </div>
          <div className="rounded-md border border-border-subtle bg-surface-paper p-4 sm:col-span-2">
            <FileWarning className="h-4 w-4 text-research-red" />
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.1em] text-text-neutral">Artifact dependency</p>
            <p className="mt-1 text-sm leading-6 text-text-neutral">{model.artifactDependency}</p>
          </div>
        </div>
      </div>
      <div className="grid gap-4 px-5 py-5 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-md border border-border-subtle bg-surface-paper p-5">
          <h3 className="font-display text-[clamp(1.35rem,2.2vw,2rem)] font-medium leading-none text-text-institutional">Evidence Rail</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-text-neutral">The assumptions, limitations, unsupported claims, and missing inputs that bound this page.</p>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <ListBlock title="Assumptions" items={model.assumptions} empty="No explicit assumptions were emitted for this page." />
            <ListBlock title="Limitations" items={model.limitations} empty="No explicit limitations were emitted for this page." />
            <ListBlock title="Unsupported claims" items={model.unsupportedClaims} empty="No unsupported claim was attached to this page." />
            <ListBlock title="Missing evidence" items={model.missingEvidence} empty="No missing evidence item was emitted for this page." />
          </div>
        </div>
        <div className="rounded-md border border-border-subtle bg-surface-paper p-5">
          <h3 className="font-display text-[clamp(1.35rem,2.2vw,2rem)] font-medium leading-none text-text-institutional">Next Evidence</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-text-neutral">What would make the diagnostic more decision-grade.</p>
          <div className="mt-5 space-y-4">
            <ul className="space-y-2 text-sm leading-6 text-text-neutral">
              {model.nextEvidence.map((item, index) => <li key={`next-${index}-${item.slice(0, 24)}`}>- {item}</li>)}
            </ul>
            <div className="rounded-md border border-border-subtle bg-surface-subtle p-4">
              <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">Report impact</p>
              <p className="mt-2 text-sm leading-6 text-text-neutral">{model.reportImpact}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
