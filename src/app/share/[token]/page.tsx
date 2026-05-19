import { notFound } from "next/navigation";
import { PublicShell } from "@/components/public/public-shell";
import { EvidenceStatusBadge, normalizeEvidenceState } from "@/components/dashboard/evidence-status";
import { resolveSharedReport } from "@/lib/server/share/share-service";

export default async function SharedReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = resolveSharedReport({ token });
  if (!result.view) notFound();
  const report = result.view;

  return (
    <PublicShell>
      <main className="bg-surface-white">
        <section className="public-hero-band border-b border-border-subtle">
          <div className="container-shell py-section-md md:py-section-lg">
            <div className="max-w-4xl space-y-4">
              <p className="font-provenance text-[11px] uppercase tracking-[0.12em] text-brand">Shared validation artifact / {report.snapshot_id.slice(0, 8)}</p>
              <h1 className="font-display text-[clamp(2.7rem,10vw,5.5rem)] font-medium leading-none">{report.strategy_name}</h1>
              <p className="max-w-3xl text-base leading-7 text-text-neutral">{report.verdict.summary}</p>
              <div className="flex flex-wrap gap-2">
                <EvidenceStatusBadge state={normalizeEvidenceState(report.verdict.posture)} label={report.verdict.statusLabel} />
                <EvidenceStatusBadge state={report.status === "available" ? "supported" : "limited"} label={report.status} />
              </div>
            </div>
          </div>
        </section>

        <section className="container-shell grid gap-5 py-section-sm md:grid-cols-4">
          {report.decision_metrics.slice(0, 4).map((metric) => (
            <div key={metric.label} className="artifact-surface p-4">
              <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">{metric.label}</p>
              <p className="mt-2 text-2xl font-medium text-text-institutional">{metric.value}</p>
            </div>
          ))}
        </section>

        <section className="container-shell grid gap-5 pb-section-lg lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-5">
            <div className="artifact-surface p-5">
              <h2 className="text-xl font-semibold">Deployment guidance</h2>
              <p className="mt-2 text-sm leading-7 text-text-neutral">{report.deployment_guidance.summary}</p>
              <ul className="mt-4 space-y-2 text-sm text-text-neutral">
                {report.deployment_guidance.nextActions.map((item) => <li key={item}>- {item}</li>)}
              </ul>
            </div>
            <div className="artifact-surface p-5">
              <h2 className="text-xl font-semibold">Limitations</h2>
              <ul className="mt-4 space-y-2 text-sm text-text-neutral">
                {(report.limitations.length ? report.limitations : ["No explicit limitations were included in this snapshot."]).map((item) => <li key={item}>- {item}</li>)}
              </ul>
            </div>
            <div className="artifact-surface p-5">
              <h2 className="text-xl font-semibold">Proof boundaries</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">Unsupported claims</p>
                  <ul className="mt-3 space-y-2 text-sm text-text-neutral">
                    {(report.unsupported_claims.length ? report.unsupported_claims.map((claim) => `${claim.claim}: ${claim.report_wording}`) : ["No unsupported claim was included in this snapshot."]).map((item) => <li key={item}>- {item}</li>)}
                  </ul>
                </div>
                <div>
                  <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">What this result does not prove</p>
                  <ul className="mt-3 space-y-2 text-sm text-text-neutral">
                    {(report.what_this_result_does_not_prove.length ? report.what_this_result_does_not_prove : ["No explicit proof exclusions were included in this snapshot."]).map((item) => <li key={item}>- {item}</li>)}
                  </ul>
                </div>
              </div>
            </div>
            {report.reviewer_addenda.length ? (
              <div className="artifact-surface border-research-red/20 bg-research-red/5 p-5">
                <h2 className="text-xl font-semibold">Reviewer addenda</h2>
                <div className="mt-4 space-y-3">
                  {report.reviewer_addenda.map((addendum) => (
                    <div key={addendum.addendum_id} className="rounded-sm border border-research-red/20 bg-surface-white p-3">
                      <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-brand">Research Desk approved{addendum.approved_at ? ` / ${addendum.approved_at}` : ""}</p>
                      <p className="mt-2 text-sm leading-7 text-text-neutral">{addendum.public_addendum}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <aside className="artifact-surface h-fit p-5">
            <h2 className="text-xl font-semibold">Evidence ledger</h2>
            <div className="mt-4 space-y-2">
              {report.evidence_ledger.map((entry) => (
                <div key={entry.diagnostic} className="flex items-center justify-between gap-3 border-b border-border-subtle pb-2 last:border-b-0">
                  <span className="text-sm text-text-graphite">{entry.diagnostic.replace("_", " ")}</span>
                  <EvidenceStatusBadge state={normalizeEvidenceState(entry.display_status)} label={entry.display_status} />
                </div>
              ))}
            </div>
            <div className="mt-5 border-t border-border-subtle pt-4">
              <h3 className="text-sm font-semibold text-text-institutional">Share boundary</h3>
              <ul className="mt-3 space-y-2 text-xs leading-5 text-text-neutral">
                {report.redaction_policy.public_share_excludes.map((item) => <li key={item}>- Excludes {item}</li>)}
                <li>- Public downloads: {report.download_policy.public_pdf_download ? "enabled" : "disabled"}</li>
                <li>- Raw trade files: {report.redaction_policy.raw_trade_files_public ? "included" : "excluded"}</li>
              </ul>
            </div>
            {report.excluded_diagnostics.length ? (
              <div className="mt-5 border-t border-border-subtle pt-4">
                <h3 className="text-sm font-semibold text-text-institutional">Excluded diagnostics</h3>
                <ul className="mt-3 space-y-2 text-xs leading-5 text-text-neutral">
                  {report.excluded_diagnostics.map((item) => <li key={item.diagnostic}>- {item.diagnostic.replace("_", " ")}: {item.reason ?? item.status}</li>)}
                </ul>
              </div>
            ) : null}
          </aside>
        </section>
      </main>
    </PublicShell>
  );
}
