"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  Download,
  FileCode2,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { C2ProgramDetail } from "@/lib/server/research-c2/models";
import type { ResearchSpecBridgeDetail } from "@/lib/server/research-specs-v2/models";
import type { ExperimentJobRecord } from "@/lib/server/research-programs/models";

async function post(programId: string, body: Record<string, unknown>) {
  const r = await fetch(`/api/programs/${programId}/research-qualification`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    p = await r.json();
  if (!r.ok) throw new Error(p.error?.message ?? "c2_action_failed");
  return p;
}
const defaultEvidence = {
  code_hash: "",
  data_snapshot_id: "",
  config_hash: "",
  truth_certification: "PASS",
  blocking_contract_errors: false,
  fees_bps: 0,
  slippage_bps: 0,
  spread_bps: 0,
  timing_model: "next_bar_execution",
  leverage: 1,
  liquidation_model: "engine",
  trade_count: 0,
  minimum_trade_count: 30,
  coverage_days: 0,
  minimum_coverage_days: 90,
  holdout_required: true,
  holdout_status: "PENDING",
  cost_survival: "PENDING",
  risk_of_ruin: 1,
  maximum_risk_of_ruin: 0.05,
  symbols: ["BTCUSDT"],
  exchange_product_type: "perpetual",
  unresolved_critical_verdicts: 0,
  limitations: [],
};
type C2ActionResponse = {
  qualification?: { snapshot: Record<string, unknown> };
  credential?: { webhook_path?: string };
  compatibility?: Record<string, unknown>;
};
export function QualificationPinePanel({
  programId,
  initialDetail,
  specs,
  experimentJobs = [],
}: {
  programId: string;
  initialDetail: C2ProgramDetail;
  specs: ResearchSpecBridgeDetail;
  experimentJobs?: ExperimentJobRecord[];
}) {
  const completedJobs = experimentJobs.filter(
    (job) => job.status === "completed",
  );
  const [detail, setDetail] = useState(initialDetail),
    [busy, setBusy] = useState<string | null>(null),
    [error, setError] = useState<string | null>(null),
    [evidence, setEvidence] = useState(
      JSON.stringify(defaultEvidence, null, 2),
    ),
    [experimentJobId, setExperimentJobId] = useState(
      completedJobs[0]?.experiment_job_id ?? "",
    ),
    [approval, setApproval] = useState("{}"),
    [exact, setExact] = useState(false),
    [pineSource, setPineSource] = useState(
      '//@version=6\nindicator("Imported idea", overlay=true)\n',
    ),
    [parity, setParity] = useState(
      JSON.stringify(
        {
          engine_signals: [],
          tradingview_signals: [],
          context: {
            symbol: "BTCUSDT",
            timeframe: "15m",
            window_start: "",
            window_end: "",
            timezone: "UTC",
            session: "24x7",
            parameter_hash: "",
          },
        },
        null,
        2,
      ),
    ),
    [credential, setCredential] = useState<string | null>(null),
    [compatibility, setCompatibility] = useState<Record<
      string,
      unknown
    > | null>(null);
  const router = useRouter(),
    approved = specs.bundles.find((x) => x.status === "approved"),
    latestQ = detail.qualifications[0],
    latestP = detail.pine_exports[0],
    latestJob = detail.pine_export_jobs[0],
    latestImport = detail.pine_imports[0],
    activeCredential = detail.alert_credentials.find(
      (x) =>
        x.status === "active" && x.pine_export_id === latestP?.pine_export_id,
    );
  async function reload() {
    const r = await fetch(`/api/programs/${programId}/research-qualification`, {
        cache: "no-store",
      }),
      p = await r.json();
    if (r.ok) setDetail(p.detail);
    router.refresh();
  }
  async function act(k: string, f: () => Promise<unknown>) {
    setBusy(k);
    setError(null);
    try {
      const p = (await f()) as C2ActionResponse;
      if (p.qualification) {
        const s = p.qualification.snapshot;
        setApproval(
          JSON.stringify(
            {
              strategy_spec_hash: s.strategy_spec_hash,
              risk_policy_hash: s.risk_policy_hash,
              config_hash: s.config_hash,
            },
            null,
            2,
          ),
        );
      }
      if (p.credential?.webhook_path)
        setCredential(`${location.origin}${p.credential.webhook_path}`);
      if (p.compatibility) setCompatibility(p.compatibility);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "c2_action_failed");
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-md border border-border-subtle bg-surface-white p-5">
          <p className="font-provenance text-[10px] uppercase text-brand">
            Qualification
          </p>
          <h3 className="mt-2 text-base font-semibold text-text-institutional">
            Backtest to demo decision
          </h3>
          <p className="mt-2 text-sm leading-6 text-text-neutral">
            Checks reproducibility, truth certification, execution assumptions,
            sample coverage, holdout, cost survival, ruin, unresolved verdicts,
            compatibility, and exact-hash approval.
          </p>
          {latestQ ? (
            <div
              className={`mt-4 border-l-2 px-4 py-3 ${latestQ.status === "qualified" ? "border-emerald-500 bg-emerald-50" : "border-amber-500 bg-amber-50"}`}
            >
              <p className="text-sm font-semibold">{latestQ.status}</p>
              <p className="mt-1 text-xs">
                {((latestQ.snapshot.blockers as string[]) ?? []).length
                  ? `Blocked by: ${(latestQ.snapshot.blockers as string[]).join(", ")}`
                  : "Exact approved evidence satisfies every rule."}
              </p>
            </div>
          ) : null}
          <label className="mt-4 block text-xs font-medium text-text-institutional">
            Evidence run
            <select
              value={experimentJobId}
              onChange={(event) => setExperimentJobId(event.target.value)}
              className="mt-2 w-full rounded-sm border border-border-subtle bg-surface-white px-3 py-2 text-sm"
            >
              <option value="">Imported or manually attested evidence</option>
              {completedJobs.map((job) => (
                <option
                  key={job.experiment_job_id}
                  value={job.experiment_job_id}
                >
                  {job.experiment_job_id.slice(0, 12)} · completed{" "}
                  {job.finished_at
                    ? new Date(job.finished_at).toLocaleDateString()
                    : ""}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-2 text-xs leading-5 text-text-neutral">
            When a completed run is selected, canonical event evidence and its
            run-config hash override matching editable fields. Missing evidence
            remains a blocker.
          </p>
          <textarea
            aria-label="Qualification evidence"
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            className="mt-4 min-h-[260px] w-full rounded-sm border border-border-subtle p-3 font-mono text-[11px] leading-5"
          />
          <textarea
            aria-label="Exact hash approval"
            value={approval}
            onChange={(e) => setApproval(e.target.value)}
            className="mt-3 min-h-[100px] w-full rounded-sm border border-border-subtle p-3 font-mono text-[11px]"
          />
          <label className="mt-3 flex items-start gap-2 text-xs leading-5 text-text-neutral">
            <input
              type="checkbox"
              checked={exact}
              onChange={(e) => setExact(e.target.checked)}
              className="mt-1"
            />
            I approve these exact strategy, risk-policy, and run-config hashes
            for demo qualification review.
          </label>
          <Button
            className="mt-4"
            size="sm"
            disabled={!approved || Boolean(busy)}
            onClick={() =>
              act("qualify", () =>
                post(programId, {
                  action: "qualify",
                  spec_bundle_id: approved?.spec_bundle_id,
                  experiment_job_id: experimentJobId || undefined,
                  evidence: JSON.parse(evidence),
                  approval: JSON.parse(approval),
                  confirm_exact_hashes: exact,
                }),
              )
            }
          >
            <ShieldCheck className="h-4 w-4" />
            Evaluate qualification
          </Button>
        </section>
        <section className="rounded-md border border-border-subtle bg-surface-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-provenance text-[10px] uppercase text-brand">
                Evidence plane
              </p>
              <h3 className="mt-2 text-base font-semibold text-text-institutional">
                Program artifact catalog
              </h3>
            </div>
            <Button
              size="sm"
              variant="secondary"
              disabled={Boolean(busy)}
              onClick={() =>
                act("catalog", () =>
                  post(programId, { action: "sync_catalog" }),
                )
              }
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
          <p className="mt-2 text-sm leading-6 text-text-neutral">
            Typed, tenant-scoped evidence available to the Research Copilot.
            Unknown artifacts remain visible as unsupported.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              "metrics",
              "verdict_card",
              "spec",
              "memory",
              "report",
              "incident",
            ].map((type) => (
              <div
                key={type}
                className="rounded-sm border border-border-subtle bg-surface-subtle p-3"
              >
                <p className="font-provenance text-[10px] uppercase text-text-muted">
                  {type.replaceAll("_", " ")}
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {
                    detail.catalog.filter((x) => x.artifact_type === type)
                      .length
                  }
                </p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs leading-5 text-text-neutral">
            Artifact questions now use canonical typed queries and persist the
            exact bounded context and citation anchors used for every answer.
          </p>
        </section>
      </div>
      <section className="rounded-md border border-border-subtle bg-surface-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-provenance text-[10px] uppercase text-brand">
              TradingView bridge
            </p>
            <h3 className="mt-2 text-base font-semibold text-text-institutional">
              Visualization and interoperability
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-text-neutral">
              Pine is a deterministic chart projection of an approved spec. It
              cannot authorize deployment or orders, and parity remains
              provisional until a matching TradingView export is compared.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={!approved || Boolean(busy)}
              onClick={() =>
                act("preview", () =>
                  post(programId, {
                    action: "preview_pine",
                    spec_bundle_id: approved?.spec_bundle_id,
                  }),
                )
              }
            >
              Check compatibility
            </Button>
            <Button
              size="sm"
              disabled={!approved || Boolean(busy)}
              onClick={() =>
                act("pine", () =>
                  post(programId, {
                    action: "generate_pine",
                    spec_bundle_id: approved?.spec_bundle_id,
                  }),
                )
              }
            >
              <FileCode2 className="h-4 w-4" />
              Visualize on TradingView
            </Button>
          </div>
        </div>
        {compatibility ? (
          <div className="mt-4 rounded-sm border border-border-subtle bg-surface-subtle p-3 text-xs">
            <p className="font-semibold text-text-institutional">
              {String(compatibility.status).replaceAll("_", " ")} ·{" "}
              {String(compatibility.simulation_status).replaceAll("_", " ")}
            </p>
            {Array.isArray(compatibility.unsupported) &&
            compatibility.unsupported.length ? (
              <p className="mt-1 text-text-neutral">
                Blocked: {compatibility.unsupported.join(", ")}
              </p>
            ) : null}
          </div>
        ) : null}
        {latestJob ? (
          <p className="mt-3 font-provenance text-[10px] uppercase text-text-muted">
            Generation {latestJob.status} · {latestJob.progress_pct}%
          </p>
        ) : null}
        {latestP ? (
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
            <div className="rounded-sm border border-border-subtle bg-surface-subtle p-4">
              <p className="text-sm font-semibold">
                {latestP.compatibility_status.replaceAll("_", " ")} ·{" "}
                {latestP.parity_status}
              </p>
              <p className="mt-1 font-mono text-[10px] text-text-muted">
                {latestP.bundle_hash}
              </p>
              {latestP.status === "superseded" ? (
                <p className="mt-2 text-xs text-amber-800">
                  Superseded. Recreate scripts and alerts from the current
                  approved spec.
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={`/api/programs/${programId}/pine-exports/${latestP.pine_export_id}/download?file=strategy_visualization.pine`}
              >
                <Button size="sm" variant="secondary">
                  <Download className="h-4 w-4" />
                  Indicator
                </Button>
              </a>
              {(latestP.manifest.files as Record<string, unknown>)?.[
                "strategy_simulation.pine"
              ] ? (
                <a
                  href={`/api/programs/${programId}/pine-exports/${latestP.pine_export_id}/download?file=strategy_simulation.pine`}
                >
                  <Button size="sm" variant="secondary">
                    <Download className="h-4 w-4" />
                    Simulation
                  </Button>
                </a>
              ) : null}
              {activeCredential ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    act("revoke", () =>
                      post(programId, {
                        action: "revoke_alert_credential",
                        credential_id: activeCredential.credential_id,
                      }),
                    )
                  }
                >
                  Revoke alert
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={latestP.status !== "ready"}
                  onClick={() =>
                    act("credential", () =>
                      post(programId, {
                        action: "create_alert_credential",
                        pine_export_id: latestP.pine_export_id,
                      }),
                    )
                  }
                >
                  <Check className="h-4 w-4" />
                  Alert webhook
                </Button>
              )}
            </div>
          </div>
        ) : null}
        {credential ? (
          <div className="mt-3 flex items-center gap-2 rounded-sm border border-amber-200 bg-amber-50 p-3 text-xs">
            <code className="min-w-0 flex-1 break-all">{credential}</code>
            <button
              aria-label="Copy webhook URL"
              onClick={() => navigator.clipboard.writeText(credential)}
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        ) : null}
        {detail.alert_credentials.some((item) => item.status === "active") ? (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-medium text-text-institutional">
              Active alert credentials
            </summary>
            <div className="mt-2 space-y-2">
              {detail.alert_credentials
                .filter((item) => item.status === "active")
                .map((item) => (
                  <div
                    key={item.credential_id}
                    className="flex items-center justify-between gap-3 rounded-sm border border-border-subtle p-2 text-xs"
                  >
                    <span className="min-w-0 truncate">
                      Export {item.pine_export_id.slice(0, 12)} · expires{" "}
                      {item.expires_at
                        ? new Date(item.expires_at).toLocaleDateString()
                        : "never"}
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        act("revoke", () =>
                          post(programId, {
                            action: "revoke_alert_credential",
                            credential_id: item.credential_id,
                          }),
                        )
                      }
                    >
                      Revoke
                    </Button>
                  </div>
                ))}
            </div>
          </details>
        ) : null}
        <details className="mt-5 border-t border-border-subtle pt-4">
          <summary className="cursor-pointer text-sm font-medium">
            Restricted Pine v6 import
          </summary>
          <textarea
            value={pineSource}
            onChange={(e) => setPineSource(e.target.value)}
            className="mt-3 min-h-[160px] w-full rounded-sm border border-border-subtle p-3 font-mono text-[11px]"
          />
          <Button
            className="mt-2"
            size="sm"
            variant="secondary"
            onClick={() =>
              act("import", () =>
                post(programId, { action: "import_pine", source: pineSource }),
              )
            }
          >
            Parse into draft objects
          </Button>
          {latestImport ? (
            <pre className="mt-3 max-h-56 overflow-auto rounded-sm bg-surface-subtle p-3 text-[10px]">
              {JSON.stringify(latestImport.report, null, 2)}
            </pre>
          ) : null}
        </details>
        {latestP ? (
          <details className="mt-4 border-t border-border-subtle pt-4">
            <summary className="cursor-pointer text-sm font-medium">
              TradingView parity comparison
            </summary>
            <textarea
              value={parity}
              onChange={(e) => setParity(e.target.value)}
              className="mt-3 min-h-[220px] w-full rounded-sm border border-border-subtle p-3 font-mono text-[11px]"
            />
            <Button
              className="mt-2"
              size="sm"
              variant="secondary"
              onClick={() => {
                const p = JSON.parse(parity);
                return act("parity", () =>
                  post(programId, {
                    action: "compare_pine",
                    pine_export_id: latestP.pine_export_id,
                    ...p,
                  }),
                );
              }}
            >
              Compare signal exports
            </Button>
          </details>
        ) : null}
      </section>
      {busy ? (
        <p className="inline-flex items-center gap-2 text-xs text-text-neutral">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Updating governed research state...
        </p>
      ) : null}
      {error ? (
        <p className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {error}
        </p>
      ) : null}
    </div>
  );
}
