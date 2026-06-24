"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, Code2, FileDiff, LoaderCircle, ShieldCheck, Sparkles, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ResearchProposal } from "@/lib/server/research-copilot/models";
import type { HypothesisCardV1, ResearchSpecBridgeDetail } from "@/lib/server/research-specs-v2/models";

function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" }) {
  const toneClass = tone === "good" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : tone === "warn" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-border-subtle bg-surface-subtle text-text-neutral";
  return <span className={`inline-flex rounded-sm border px-2 py-1 font-provenance text-[10px] uppercase ${toneClass}`}>{children}</span>;
}

async function post(programId: string, body: Record<string, unknown>) {
  const response = await fetch(`/api/programs/${programId}/hypothesis-cards`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message ?? "card_action_failed");
  return payload;
}

export function HypothesisCardBridge({ programId, initialDetail, proposals }: { programId: string; initialDetail: ResearchSpecBridgeDetail; proposals: ResearchProposal[] }) {
  const [detail, setDetail] = useState(initialDetail);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latestCard = detail.cards[0];
  const latestBundle = detail.bundles[0];
  const [editor, setEditor] = useState(() => latestCard ? JSON.stringify(latestCard.card, null, 2) : "");
  const [taskEvidence, setTaskEvidence] = useState("{\n  \"diff_hash\": \"\",\n  \"submitted\": {}\n}");
  const router = useRouter();
  const convertedProposalIds = useMemo(() => new Set(detail.cards.map((item) => item.source_proposal_id)), [detail.cards]);

  async function reload() {
    const response = await fetch(`/api/programs/${programId}/hypothesis-cards`, { cache: "no-store" });
    const payload = await response.json();
    if (response.ok) {
      setDetail(payload.detail);
      const card = payload.detail.cards[0];
      if (card) setEditor(JSON.stringify(card.card, null, 2));
    }
    router.refresh();
  }
  async function act(key: string, action: () => Promise<unknown>) {
    setBusy(key); setError(null);
    try { await action(); await reload(); } catch (caught) { setError(caught instanceof Error ? caught.message : "card_action_failed"); } finally { setBusy(null); }
  }

  const provenance = latestCard ? Object.entries(latestCard.card.field_provenance) : [];
  const readiness = latestBundle?.bundle.compile_readiness;
  const previousCard = detail.cards.find((item) => latestCard && item.card_id === latestCard.card_id && item.version === latestCard.version - 1);
  const changedFields = latestCard && previousCard ? Object.keys(latestCard.card).filter((key) => JSON.stringify(latestCard.card[key as keyof HypothesisCardV1]) !== JSON.stringify(previousCard.card[key as keyof HypothesisCardV1])) : [];
  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <div className="rounded-md border border-border-subtle bg-surface-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="font-provenance text-[10px] uppercase text-brand">Confirmed intent boundary</p><h3 className="mt-2 text-base font-semibold text-text-institutional">Hypothesis Card</h3><p className="mt-1 max-w-2xl text-sm leading-6 text-text-neutral">The card is the reviewed research object between conversation and executable specifications. Generation cannot skip confirmation.</p></div>
            {latestCard ? <Pill tone={latestCard.status === "confirmed" ? "good" : "warn"}>{latestCard.status} · v{latestCard.version}</Pill> : <Pill>not created</Pill>}
          </div>

          {!latestCard ? (
            <div className="mt-5 space-y-3">
              {proposals.filter((item) => item.status === "confirmed").length ? proposals.filter((item) => item.status === "confirmed").map((proposal) => (
                <div key={proposal.proposal_id} className="flex flex-wrap items-center justify-between gap-3 border-l-2 border-brand bg-surface-subtle px-4 py-3">
                  <div><p className="text-sm font-medium text-text-institutional">{proposal.title}</p><p className="mt-1 text-xs text-text-neutral">Confirmed conversational candidate · v{proposal.version}</p></div>
                  <Button size="sm" disabled={Boolean(busy) || convertedProposalIds.has(proposal.proposal_id)} onClick={() => act("create", () => post(programId, { action: "create_from_proposal", proposal_id: proposal.proposal_id }))}><Sparkles className="h-4 w-4" /> Build draft card</Button>
                </div>
              )) : <p className="mt-4 text-sm text-text-neutral">Confirm a candidate hypothesis in the research conversation before creating a card.</p>}
            </div>
          ) : (
            <div className="mt-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-sm border border-border-subtle bg-surface-subtle p-3"><p className="font-provenance text-[10px] uppercase text-text-muted">Features</p><p className="mt-2 text-lg font-semibold text-text-institutional">{latestCard.card.features.length}</p></div>
                <div className="rounded-sm border border-border-subtle bg-surface-subtle p-3"><p className="font-provenance text-[10px] uppercase text-text-muted">Datasets</p><p className="mt-2 text-lg font-semibold text-text-institutional">{latestCard.card.data_requirements.length}</p></div>
                <div className="rounded-sm border border-border-subtle bg-surface-subtle p-3"><p className="font-provenance text-[10px] uppercase text-text-muted">Citations</p><p className="mt-2 text-lg font-semibold text-text-institutional">{latestCard.card.source_citations.length}</p></div>
              </div>
              <div className="mt-4"><p className="text-sm font-semibold text-text-institutional">{latestCard.card.title}</p><p className="mt-2 text-sm leading-6 text-text-neutral">{latestCard.card.claim}</p></div>
              <div className="mt-4 flex flex-wrap gap-2">{provenance.map(([field, value]) => <Pill key={field} tone={value.state === "confirmed" || value.state === "stated" ? "good" : "warn"}>{field}: {value.state}</Pill>)}</div>
              {previousCard ? <p className="mt-3 text-xs text-text-neutral">Changed from v{previousCard.version}: {changedFields.length ? changedFields.join(", ") : "no semantic fields"}.</p> : null}
              {latestCard.card.source_citations.length ? <div className="mt-4 border-t border-border-subtle pt-3"><p className="font-provenance text-[10px] uppercase text-text-muted">Source citations</p><div className="mt-2 space-y-2">{latestCard.card.source_citations.map((citation, index) => <div key={index} className="rounded-sm bg-surface-subtle px-3 py-2 font-mono text-[11px] text-text-neutral">{JSON.stringify(citation)}</div>)}</div></div> : null}
              {latestCard.validation_errors.length ? <div className="mt-4 space-y-2">{latestCard.validation_errors.map((item) => <div key={item} className="flex items-start gap-2 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"><TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />{item.replace(/_/g, " ")}</div>)}</div> : null}
            </div>
          )}
        </div>

        <div className="rounded-md border border-border-subtle bg-surface-subtle p-5">
          <div className="flex items-center gap-2"><FileDiff className="h-4 w-4 text-brand" /><h3 className="text-sm font-semibold text-text-institutional">Revision and approval</h3></div>
          {latestCard ? (
            <>
              <textarea aria-label="Hypothesis Card JSON" value={editor} onChange={(event) => setEditor(event.target.value)} readOnly={latestCard.status === "confirmed"} spellCheck={false} className="mt-4 min-h-[320px] w-full resize-y rounded-sm border border-border-subtle bg-surface-white p-3 font-mono text-[11px] leading-5 text-text-neutral outline-none focus:border-brand" />
              <div className="mt-3 flex flex-wrap gap-2">
                {latestCard.status === "draft" ? <Button size="sm" variant="secondary" disabled={Boolean(busy)} onClick={() => act("revise", () => post(programId, { action: "revise", card_record_id: latestCard.card_record_id, card: JSON.parse(editor) as HypothesisCardV1 }))}><Code2 className="h-4 w-4" /> Save revision</Button> : null}
                {latestCard.status === "draft" ? <Button size="sm" disabled={Boolean(busy)} onClick={() => act("confirm", () => post(programId, { action: "confirm", card_record_id: latestCard.card_record_id }))}><Check className="h-4 w-4" /> Confirm exact card</Button> : null}
                {latestCard.status === "confirmed" ? <Button size="sm" disabled={Boolean(busy)} onClick={() => act("generate", () => post(programId, { action: "generate", card_record_id: latestCard.card_record_id }))}><ShieldCheck className="h-4 w-4" /> Generate governed specs</Button> : null}
              </div>
              <p className="mt-3 text-xs leading-5 text-text-neutral">Confirmation records the exact card hash. Later changes create a new version; they do not mutate the confirmed object.</p>
            </>
          ) : <p className="mt-4 text-sm text-text-neutral">No card revision exists yet.</p>}
        </div>
      </div>

      {latestBundle ? (
        <div className="rounded-md border border-border-subtle bg-surface-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-provenance text-[10px] uppercase text-brand">Executable-spec bridge</p><h3 className="mt-2 text-base font-semibold text-text-institutional">Compiler readiness</h3></div><Pill tone={["registry_ready", "graph_compilable"].includes(latestBundle.compile_status) ? "good" : "warn"}>{latestBundle.compile_status.replace(/_/g, " ")}</Pill></div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
            <div><p className="text-sm leading-6 text-text-neutral">Schema validity, engine support, data availability, and truth certification are separate gates. This report only states compile readiness; it does not certify a backtest result.</p><div className="mt-4 flex flex-wrap gap-2"><Pill>compiler {latestBundle.compiler_version}</Pill><Pill>bundle v{latestBundle.version}</Pill><Pill tone={latestBundle.status === "approved" ? "good" : "neutral"}>{latestBundle.status}</Pill></div></div>
            <div className="space-y-2">{readiness?.blockers.length ? readiness.blockers.map((item) => <div key={`${item.code}:${item.detail}`} className="grid gap-1 rounded-sm border border-border-subtle bg-surface-subtle px-3 py-2 sm:grid-cols-[180px_1fr]"><span className="font-provenance text-[10px] uppercase text-text-muted">{item.code.replace(/_/g, " ")}</span><span className="break-words text-xs text-text-neutral">{item.detail}</span></div>) : <div className="rounded-sm border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">No compile blockers were found for the classified path.</div>}</div>
          </div>
          <details className="mt-4 border-t border-border-subtle pt-4"><summary className="cursor-pointer text-sm font-medium text-text-institutional">Inspect generated artifacts</summary><pre className="mt-3 max-h-[440px] overflow-auto rounded-sm bg-text-institutional p-4 text-[11px] leading-5 text-white">{JSON.stringify(latestBundle.bundle, null, 2)}</pre></details>
          {latestBundle.status === "generated" ? <Button className="mt-4" size="sm" disabled={Boolean(busy)} onClick={() => act("approve", () => post(programId, { action: "approve_bundle", spec_bundle_id: latestBundle.spec_bundle_id }))}><Check className="h-4 w-4" /> Approve spec bundle</Button> : null}
        </div>
      ) : null}
      {detail.implementation_tasks.length ? <div className="rounded-md border border-amber-200 bg-amber-50 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-amber-950">Implementation required</p><p className="mt-2 max-w-3xl text-sm leading-6 text-amber-900">This card needs reviewed engine behavior. The task requires admission, leakage, determinism, logging, smoke, parity, and truth-certification evidence. Approval records review only; registration and execution remain separate controls.</p></div><Pill tone="warn">{detail.implementation_tasks[0].status}</Pill></div><details className="mt-4"><summary className="cursor-pointer text-sm font-medium text-amber-950">Submit implementation evidence</summary><textarea value={taskEvidence} onChange={(event) => setTaskEvidence(event.target.value)} className="mt-3 min-h-[180px] w-full rounded-sm border border-amber-200 bg-white p-3 font-mono text-[11px] leading-5"/><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="secondary" disabled={Boolean(busy) || !["draft", "in_review"].includes(detail.implementation_tasks[0].status)} onClick={() => act("task_evidence", () => post(programId, { action: "submit_task_evidence", task_id: detail.implementation_tasks[0].task_id, evidence: JSON.parse(taskEvidence) }))}>Submit evidence</Button><Button size="sm" disabled={Boolean(busy) || detail.implementation_tasks[0].status !== "in_review"} onClick={() => act("task_approve", () => post(programId, { action: "approve_task", task_id: detail.implementation_tasks[0].task_id }))}><ShieldCheck className="h-4 w-4"/> Approve reviewed implementation</Button></div></details></div> : null}
      {busy ? <p className="inline-flex items-center gap-2 text-xs text-text-neutral"><LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Updating the research object...</p> : null}
      {error ? <p className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p> : null}
    </div>
  );
}
