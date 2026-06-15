import { notFound } from "next/navigation";
import { PublicShell } from "@/components/public/public-shell";
import { EvidenceStatusBadge } from "@/components/dashboard/evidence-status";
import { resolveProgramReportShare } from "@/lib/server/research-programs/program-report-service";

export default async function ProgramSharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const resolved = await resolveProgramReportShare({ token });
  if (!resolved) notFound();
  const report = resolved.report.payload;

  return (
    <PublicShell>
      <main className="bg-surface-white">
        <section className="public-hero-band border-b border-border-subtle">
          <div className="container-shell py-section-md md:py-section-lg">
            <div className="max-w-4xl space-y-4">
              <p className="font-provenance text-[11px] uppercase tracking-[0.12em] text-brand">Shared research program / {resolved.report.program_report_snapshot_id.slice(0, 8)}</p>
              <h1 className="font-display text-[clamp(2.7rem,10vw,5.5rem)] font-medium leading-none">{report.title}</h1>
              <p className="max-w-3xl text-base leading-7 text-text-neutral">{report.research_question.thesis}</p>
              <div className="flex flex-wrap gap-2">
                <EvidenceStatusBadge state="supported" label={`${report.hypotheses_tested.length} hypotheses`} />
                <EvidenceStatusBadge state="limited" label={`${report.experiments_run.length} experiments`} />
                <EvidenceStatusBadge state="limited" label={`${report.evidence_limits.length} limits`} />
              </div>
            </div>
          </div>
        </section>

        <section className="container-shell grid gap-5 py-section-sm md:grid-cols-4">
          {[
            ["Hypotheses", report.hypotheses_tested.length],
            ["Experiments", report.experiments_run.length],
            ["Survivors", report.surviving_candidates.length],
            ["Rejected", report.rejected_variants.length],
          ].map(([label, value]) => (
            <div key={label} className="artifact-surface p-4">
              <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">{label}</p>
              <p className="mt-2 text-2xl font-medium text-text-institutional">{value}</p>
            </div>
          ))}
        </section>

        <section className="container-shell grid gap-5 pb-section-lg lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-5">
            <div className="artifact-surface p-5">
              <h2 className="text-xl font-semibold">Hypotheses tested</h2>
              <div className="mt-4 space-y-3">
                {(report.hypotheses_tested.length ? report.hypotheses_tested : [{ title: "No hypothesis recorded", thesis: "No hypothesis spec has been approved yet.", status: "missing", invalidation_criteria: [], required_datasets: [], hypothesis_version_id: "missing" }]).map((hypothesis) => (
                  <div key={hypothesis.hypothesis_version_id} className="rounded-sm border border-border-subtle bg-surface-subtle p-3">
                    <p className="font-medium text-text-institutional">{hypothesis.title}</p>
                    <p className="mt-2 text-sm leading-6 text-text-neutral">{hypothesis.thesis}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="artifact-surface p-5">
              <h2 className="text-xl font-semibold">Experiments run</h2>
              <div className="mt-4 space-y-3">
                {(report.experiments_run.length ? report.experiments_run : [{ experiment_job_id: "missing", status: "queued", current_step: "No experiment run has been recorded yet.", progress_pct: 0, created_at: report.generated_at }]).map((experiment) => (
                  <div key={experiment.experiment_job_id} className="rounded-sm border border-border-subtle bg-surface-subtle p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-text-institutional">Run {experiment.experiment_job_id.slice(0, 8)}</p>
                      <span className="rounded-sm border border-border-subtle bg-surface-white px-2 py-1 text-xs text-text-neutral">{experiment.status}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-text-neutral">{"verdict" in experiment && experiment.verdict ? experiment.verdict.replace(/_/g, " ") : experiment.current_step}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="artifact-surface p-5">
              <h2 className="text-xl font-semibold">Decision path</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">Surviving candidates</p>
                  <ul className="mt-3 space-y-2 text-sm text-text-neutral">
                    {(report.surviving_candidates.length ? report.surviving_candidates.map((item) => `${item.title}: ${item.support}`) : ["No surviving candidate has been promoted yet."]).map((item) => <li key={item}>- {item}</li>)}
                  </ul>
                </div>
                <div>
                  <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">Rejected variants</p>
                  <ul className="mt-3 space-y-2 text-sm text-text-neutral">
                    {(report.rejected_variants.length ? report.rejected_variants.map((item) => `${item.title}: ${item.reason}`) : ["No rejected variant has been recorded yet."]).map((item) => <li key={item}>- {item}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <aside className="artifact-surface h-fit p-5">
            <h2 className="text-xl font-semibold">Evidence limits</h2>
            <ul className="mt-4 space-y-2 text-sm leading-6 text-text-neutral">
              {(report.evidence_limits.length ? report.evidence_limits : ["No material evidence limit was recorded."]).map((item) => <li key={item}>- {item}</li>)}
            </ul>
            <div className="mt-5 border-t border-border-subtle pt-4">
              <h3 className="text-sm font-semibold text-text-institutional">Next experiment plan</h3>
              <ul className="mt-3 space-y-2 text-xs leading-5 text-text-neutral">
                {(report.next_experiment_plan.length ? report.next_experiment_plan : ["No next experiment has been proposed yet."]).map((item) => <li key={item}>- {item}</li>)}
              </ul>
            </div>
            <div className="mt-5 border-t border-border-subtle pt-4">
              <h3 className="text-sm font-semibold text-text-institutional">Share boundary</h3>
              <ul className="mt-3 space-y-2 text-xs leading-5 text-text-neutral">
                {report.redaction_policy.public_share_excludes.map((item) => <li key={item}>- Excludes {item}</li>)}
                <li>- Raw artifacts: {report.redaction_policy.raw_artifacts_public ? "included" : "excluded"}</li>
              </ul>
            </div>
          </aside>
        </section>
      </main>
    </PublicShell>
  );
}
