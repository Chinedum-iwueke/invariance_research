"use client";

import { useMemo, useState, type FormEvent } from "react";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import { RESEARCH_DESK_SERVICES, type ResearchDeskService } from "@/lib/server/research-desk/models";
import { cn } from "@/lib/utils";

const SERVICE_LABELS: Record<ResearchDeskService, string> = {
  execution_audit: "Execution audit",
  data_quality_audit: "Data quality audit",
  benchmark_construction: "Benchmark construction",
  parameter_stability_review: "Parameter stability review",
  regime_context_review: "Regime/context review",
  claim_validation: "Claim validation",
  investor_buyer_memo_review: "Investor/buyer memo review",
};

export function ResearchDeskRequestPanel({
  analysisId,
  limitations,
  defaultServices = ["execution_audit", "data_quality_audit", "benchmark_construction"],
}: {
  analysisId: string;
  limitations: string[];
  defaultServices?: ResearchDeskService[];
}) {
  const normalizedLimitations = useMemo(
    () => limitations.map((item) => item.trim()).filter((item, index, all) => item.length > 0 && all.indexOf(item) === index).slice(0, 8),
    [limitations],
  );
  const [triggerLimitation, setTriggerLimitation] = useState(normalizedLimitations[0] ?? "General deeper validation request");
  const [services, setServices] = useState<ResearchDeskService[]>(defaultServices);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "submitted" | "error">("idle");
  const [requestId, setRequestId] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    const response = await fetch(`/api/analyses/${analysisId}/research-desk-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trigger_limitation: triggerLimitation,
        requested_services: services,
        user_note: note,
      }),
    });
    if (!response.ok) {
      setStatus("error");
      return;
    }
    const payload = await response.json() as { request?: { request_id?: string } };
    setRequestId(payload.request?.request_id);
    setStatus("submitted");
  }

  function toggleService(service: ResearchDeskService) {
    setServices((current) => (
      current.includes(service)
        ? current.filter((item) => item !== service)
        : [...current, service]
    ));
  }

  const submitLabel = status === "submitting" ? "Creating packet..." : "Request deeper validation";
  const submitDisabled = status === "submitting" || services.length === 0;

  return (
    <form onSubmit={submit} className="rounded-md border border-research-red/20 bg-surface-white p-4 shadow-sm">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
        <div>
          <p className="font-provenance text-[10px] uppercase tracking-[0.14em] text-research-red">Research Desk request</p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-text-institutional">Turn this limitation into a review packet.</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-text-neutral">
            The request is tied to this analysis, immutable report snapshot, source artifact, and selected limitation so a reviewer can add decision-grade context without losing provenance.
          </p>
        </div>
        <button
          type="submit"
          disabled={submitDisabled}
          className="inline-flex w-full items-center justify-center gap-2 rounded-sm bg-research-red px-4 py-2 text-sm font-semibold text-white transition hover:bg-research-red/90 disabled:cursor-not-allowed disabled:opacity-60 lg:w-auto"
        >
          {submitLabel}
          <ArrowUpRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 rounded-md border border-border-subtle bg-surface-subtle p-3 text-xs text-text-neutral">
        <p className="font-semibold text-text-graphite">Validation packet includes</p>
        <p className="mt-2">report snapshot, artifact manifest, evidence ledger, assumption ledger, unsupported claims, diagnostic outputs, requested questions, client notes, and reviewer checklist.</p>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-border-subtle bg-surface-subtle p-3 text-xs text-text-neutral">
          <p className="font-semibold text-text-graphite">Flow</p>
          <p className="mt-2">Select the report limitation, choose the review services, add reviewer context, then create the packet. Admin/reviewer workflow picks it up from the Research Desk queue.</p>
        </div>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-graphite">Limitation to review</span>
          <select
            value={triggerLimitation}
            onChange={(event) => setTriggerLimitation(event.target.value)}
            className="w-full rounded-sm border border-border-subtle bg-surface-paper px-3 py-2 text-sm text-text-graphite outline-none focus:border-research-red"
          >
            {normalizedLimitations.length ? normalizedLimitations.map((limitation) => (
              <option key={limitation} value={limitation}>{limitation}</option>
            )) : <option value="General deeper validation request">General deeper validation request</option>}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-graphite">Reviewer context</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            className="w-full resize-none rounded-sm border border-border-subtle bg-surface-paper px-3 py-2 text-sm text-text-graphite outline-none focus:border-research-red"
            placeholder="What decision are you trying to make from this report?"
          />
        </label>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-3">
        {RESEARCH_DESK_SERVICES.map((service) => {
          const selected = services.includes(service);
          return (
            <button
              key={service}
              type="button"
              onClick={() => toggleService(service)}
              className={cn(
                "rounded-sm border px-3 py-2 text-left text-xs font-medium transition",
                selected ? "border-research-red bg-research-red/10 text-research-red" : "border-border-subtle bg-surface-paper text-text-neutral hover:border-research-red/40",
              )}
            >
              {SERVICE_LABELS[service]}
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={submitDisabled}
          className="inline-flex items-center gap-2 rounded-sm bg-research-red px-4 py-2 text-sm font-semibold text-white transition hover:bg-research-red/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitLabel}
          <ArrowUpRight className="h-4 w-4" />
        </button>
        {status === "submitted" ? (
          <span className="inline-flex items-center gap-2 text-sm text-chart-positive">
            <CheckCircle2 className="h-4 w-4" /> Queued for Research Desk{requestId ? ` · ${requestId.slice(0, 8)}` : ""}
          </span>
        ) : null}
        {status === "error" ? <span className="text-sm text-chart-negative">Request failed. Refresh and try again.</span> : null}
      </div>
    </form>
  );
}
