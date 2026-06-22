import type { ExperimentJobEventRecord, ExperimentJobRecord } from "@/lib/server/research-programs/models";

type CardSummary = {
  schema_version?: string;
  card_count?: number;
  verdict?: string;
  confidence?: string;
  decision_grade?: boolean;
  recommended_action?: string;
  warning_count?: number;
  cards?: Array<{
    card_type?: string;
    title?: string;
    summary?: string;
    status?: string;
    warnings?: string[];
    data?: Record<string, unknown>;
  }>;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function cardSummaryFrom(event: ExperimentJobEventRecord): CardSummary | undefined {
  const payload = asRecord(event.payload);
  const summary = asRecord(payload.card_summary);
  return summary.card_count ? summary as CardSummary : undefined;
}

function latestCardEvents(events: ExperimentJobEventRecord[]) {
  return events
    .filter((event) => event.event_type === "completed" || event.event_type === "failed")
    .map((event) => ({ event, summary: cardSummaryFrom(event) }))
    .filter((item): item is { event: ExperimentJobEventRecord; summary: CardSummary } => Boolean(item.summary))
    .slice(0, 5);
}

function statusTone(summary: CardSummary) {
  if (summary.verdict === "execution_failed") return "border-red-200 bg-red-50 text-red-800";
  if (summary.decision_grade === false) return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

function pretty(value: string | undefined) {
  return value ? value.replace(/_/g, " ") : "not recorded";
}

function cardByType(summary: CardSummary, type: string) {
  return summary.cards?.find((card) => card.card_type === type);
}

export function ExperimentVerdictCards({ jobs, events }: { jobs: ExperimentJobRecord[]; events: ExperimentJobEventRecord[] }) {
  const cardEvents = latestCardEvents(events);
  if (cardEvents.length === 0) {
    return (
      <div className="rounded-md border border-border-subtle bg-surface-subtle p-4 text-sm leading-6 text-text-neutral">
        No verdict cards have been recorded yet. Queue an approved experiment to produce its verdict packet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {cardEvents.map(({ event, summary }) => {
        const job = jobs.find((candidate) => candidate.experiment_job_id === event.experiment_job_id);
        const verdict = cardByType(summary, "VerdictCard");
        const failure = cardByType(summary, "FailureCauseCard");
        const next = cardByType(summary, "NextExperimentCard");
        const supporting = ["RunQualityCard", "ExecutionDragCard", "RegimeStateDependencyCard", "ParameterFragilityCard", "NullComparisonCard"]
          .map((type) => cardByType(summary, type))
          .filter((card): card is NonNullable<typeof card> => Boolean(card));

        return (
          <article key={event.experiment_job_event_id} className="overflow-hidden rounded-md border border-border-subtle bg-surface-white">
            <div className="grid gap-4 border-b border-border-subtle bg-surface-subtle p-4 lg:grid-cols-[1fr_auto] lg:items-start">
              <div>
                <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">Experiment verdict</p>
                <h3 className="mt-1 font-medium text-text-institutional">{job?.current_step ?? event.message}</h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-text-neutral">{verdict?.summary ?? event.message}</p>
              </div>
              <div className={`rounded-sm border px-3 py-2 text-xs font-medium uppercase tracking-[0.08em] ${statusTone(summary)}`}>
                {pretty(summary.verdict)}
              </div>
            </div>

            <div className="grid gap-4 p-4 xl:grid-cols-3">
              <div className="rounded-md border border-border-subtle bg-surface-subtle p-3">
                <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">Decision grade</p>
                <p className="mt-2 text-sm font-medium text-text-institutional">{summary.decision_grade ? "Decision grade" : "Not decision grade yet"}</p>
                <p className="mt-2 text-xs leading-5 text-text-neutral">{verdict?.summary ?? "Verdict card was recorded without a long-form summary."}</p>
              </div>
              <div className="rounded-md border border-border-subtle bg-surface-subtle p-3">
                <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">Failure / survival reason</p>
                <p className="mt-2 text-sm font-medium text-text-institutional">{pretty(failure?.status)}</p>
                <p className="mt-2 text-xs leading-5 text-text-neutral">{failure?.summary ?? "No failure detected by the current card packet."}</p>
              </div>
              <div className="rounded-md border border-border-subtle bg-surface-subtle p-3">
                <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">Next experiment</p>
                <p className="mt-2 text-sm font-medium text-text-institutional">{pretty(summary.recommended_action)}</p>
                <p className="mt-2 text-xs leading-5 text-text-neutral">{next?.summary ?? "Review the next experiment card before queueing additional work."}</p>
              </div>
            </div>

            {supporting.length > 0 ? (
              <div className="grid gap-3 border-t border-border-subtle bg-surface-white p-4 md:grid-cols-2 xl:grid-cols-3">
                {supporting.map((card) => (
                  <div key={card.card_type} className="rounded-md border border-border-subtle bg-surface-subtle p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-text-institutional">{pretty(card.card_type)}</p>
                      {card.warnings?.length ? <span className="rounded-sm border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">{card.warnings.length} caveat(s)</span> : null}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-text-neutral">{card.summary ?? "Card recorded. Open the stored JSON artifact for full details."}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
