import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { PublicShell } from "@/components/public/public-shell";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Strategy Robustness Lab Upload Docs",
  description: "Canonical upload specification for trade CSVs, exchange exports, optional context ZIPs, prop evaluation rules, and runtime assumptions.",
};

const requiredFields = [
  { field: "symbol", meaning: "Instrument identifier.", example: "BTCUSDT", aliases: "symbol, ticker, instrument, asset" },
  { field: "side", meaning: "Trade direction (normalizes to long/short).", example: "long", aliases: "side, direction, position_side, trade_side" },
  { field: "entry_time", meaning: "Entry timestamp (UTC ISO after normalization).", example: "2026-01-05T10:00:00Z", aliases: "entry_time, entry time, entry, opened_at, open_time" },
  { field: "exit_time", meaning: "Exit timestamp (UTC ISO after normalization).", example: "2026-01-05T14:30:00Z", aliases: "exit_time, exit time, exit, closed_at, close_time" },
  { field: "entry_price", meaning: "Entry price.", example: "43125.50", aliases: "entry_price, entry price, open_price, buy_price" },
  { field: "exit_price", meaning: "Exit price.", example: "43520.00", aliases: "exit_price, exit price, close_price, sell_price" },
  { field: "quantity", meaning: "Position size (> 0).", example: "0.50", aliases: "quantity, qty, size, position_size" },
] as const;

const optionalEconomicFields = [
  { field: "pnl", meaning: "Absolute P&L for trade.", example: "197.25", aliases: "pnl, profit, net_pnl, realized_pnl" },
  { field: "pnl_pct", meaning: "Trade return in percent units.", example: "0.92", aliases: "pnl_pct, return_pct, pnl_percent, roi" },
  { field: "fees", meaning: "Commissions/fees.", example: "6.75", aliases: "fees, fee, commission, cost" },
  { field: "duration_seconds", meaning: "Trade duration in seconds.", example: "16200", aliases: "duration_seconds" },
] as const;

const optionalExcursionFields = [
  { field: "mae", meaning: "Max adverse excursion.", example: "-120.00", aliases: "mae, mae_price, max_adverse_excursion" },
  { field: "mfe", meaning: "Max favorable excursion.", example: "320.00", aliases: "mfe, mfe_price, max_favorable_excursion" },
] as const;

const optionalRiskFields = [
  { field: "risk_amount", meaning: "Risk capital tied to trade.", example: "1000", aliases: "risk_amount, risk, risk_amt" },
  { field: "stop_distance", meaning: "Entry-to-stop distance.", example: "80", aliases: "stop_distance, entry_stop_distance, stop_dist" },
  { field: "r_multiple", meaning: "Net/generic R multiple.", example: "1.75", aliases: "r_multiple, r, r_value" },
  { field: "r_multiple_net", meaning: "Net R multiple.", example: "1.62", aliases: "r_multiple_net" },
  { field: "r_multiple_gross", meaning: "Gross R multiple.", example: "1.70", aliases: "r_multiple_gross" },
] as const;

const optionalMetadataFields = [
  { field: "trade_id", meaning: "Unique trade identifier.", example: "T-2026-00142", aliases: "trade_id, id, ticket, order_id" },
  { field: "strategy_name", meaning: "Strategy label.", example: "mean_revert_v4", aliases: "strategy_name, strategy, system" },
  { field: "timeframe", meaning: "Execution timeframe.", example: "1h", aliases: "timeframe, tf, interval" },
  { field: "market", meaning: "Market or asset class hint.", example: "crypto", aliases: "market, asset_class" },
  { field: "exchange", meaning: "Execution venue.", example: "binance", aliases: "exchange, venue" },
  { field: "notes", meaning: "Free-form notes.", example: "post-FOMC continuation", aliases: "notes" },
  { field: "entry_reason", meaning: "Entry rationale text.", example: "breakout confirmation", aliases: "entry_reason" },
  { field: "exit_reason", meaning: "Exit rationale text.", example: "target hit", aliases: "exit_reason" },
] as const;

const referenceBundleHref = "/downloads/strategy-truth-room-research-bundle-reference.zip";

const evidencePackages = [
  {
    tier: "Minimum launch path",
    name: "Trade CSV / exchange export",
    files: "trades.csv only",
    unlocks: "Prop evaluation preview, first breach, rolling windows, overview, distribution, Monte Carlo, ruin, and report preview/export by plan.",
    limits: "Decision-grade prop evaluation requires exact rule inputs. Broker realism remains limited without execution evidence.",
  },
  {
    tier: "Best self-serve path",
    name: "Rich trade CSV + exact prop rules",
    files: "trades.csv with PnL, fees, MAE/MFE, risk fields, R-multiple fields, plus runtime prop evaluation rules.",
    unlocks: "Decision-grade automated prop evaluation reconstruction, cleaner first-breach timing, target-before-breach windows, and stronger survivability interpretation.",
    limits: "Still does not prove true parameter stability, multi-asset regime attribution, or broker-level microstructure realism.",
  },
  {
    tier: "Optional enrichment",
    name: "Context ZIP",
    files: "manifest.json, trades.csv, equity curve, assumptions, broker export, benchmark, claims, and provenance files.",
    unlocks: "Stronger context, provenance, report quality, and Research Desk packet quality.",
    limits: "Context ZIPs do not convert incomplete evidence into automated regime, parameter, broker, portfolio, or independent validation proof.",
  },
] as const;

function SpecTable({ rows, required = false }: { rows: readonly { field: string; meaning: string; example: string; aliases: string }[]; required?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border-subtle">
      <table className="min-w-full divide-y divide-border-subtle text-sm">
        <thead className="bg-surface-panel/70 text-left text-xs uppercase tracking-wide text-text-neutral">
          <tr>
            <th className="px-4 py-3">Field</th>
            <th className="px-4 py-3">Required</th>
            <th className="px-4 py-3">Meaning</th>
            <th className="px-4 py-3">Example</th>
            <th className="px-4 py-3">Accepted aliases</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle bg-surface-white text-text-graphite">
          {rows.map((row) => (
            <tr key={row.field}>
              <td className="px-4 py-3 font-medium">{row.field}</td>
              <td className="px-4 py-3">{required ? <span className="rounded-full border border-brand/40 bg-brand/10 px-2 py-0.5 text-xs text-brand">Required</span> : "Optional"}</td>
              <td className="px-4 py-3">{row.meaning}</td>
              <td className="px-4 py-3 font-mono text-xs">{row.example}</td>
              <td className="px-4 py-3 text-xs text-text-neutral">{row.aliases}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border-subtle bg-surface-panel/50 p-4 text-xs text-text-graphite">
      <pre className="whitespace-pre">{children}</pre>
    </div>
  );
}

export default function LabDocsPage() {
  return (
    <PublicShell>
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-12 lg:px-10">
      <section className="public-hero-band space-y-4 rounded-sm border border-border-subtle p-8">
        <div className="h-1 w-20 rounded-full bg-brand" />
        <p className="font-provenance inline-flex rounded-sm border border-brand/30 bg-brand/5 px-3 py-1 text-xs uppercase tracking-wide text-brand">Lab Upload Specification</p>
        <h1 className="font-display text-5xl font-medium leading-none tracking-tight text-text-institutional">Strategy Robustness Lab Upload Docs</h1>
        <p className="text-base text-text-neutral">Accepted trade-history formats, supported fields, prop evaluation rules, runtime assumptions, and what each input unlocks.</p>
        <p className="max-w-4xl text-sm text-text-neutral">
          The launch product is optimized for closed trade history. Use a trade CSV or exchange export first, then add exact prop rules when evaluation feasibility matters. Optional ZIPs add context and provenance; they do not turn self-serve automation into true parameter stability, regime attribution, broker microstructure, portfolio exposure, or independent review.
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          <Link href={referenceBundleHref} className={buttonVariants({ variant: "primary" })}>
            Download Context ZIP Reference
          </Link>
          <Link href="#bundle-layout" className={cn(buttonVariants({ variant: "secondary" }))}>
            View Bundle Layout
          </Link>
          <Link href="#field-unlocks" className={cn(buttonVariants({ variant: "tertiary" }))}>
            See What Unlocks What
          </Link>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[{
          label: "Minimum",
          value: "Trade CSV / exchange export",
          detail: "Closed trades normalized into one ledger",
        }, {
          label: "Recommended",
          value: "Rich trade CSV + exact rules",
          detail: "Add fees, MAE/MFE, risk, R fields, and prop rules",
        }, {
          label: "Optional context",
          value: "bundle_v1 ZIP",
          detail: "trades + metadata + assumptions + provenance",
        }, {
          label: "Runtime assumptions",
          value: "Prop rules + account size + benchmark",
          detail: "Set before running analysis for decision-grade context",
        }].map((item) => (
          <article key={item.label} className="artifact-surface p-4">
            <p className="font-provenance text-xs uppercase tracking-wide text-brand">{item.label}</p>
            <p className="mt-1 text-sm font-semibold text-text-institutional">{item.value}</p>
            <p className="mt-1 text-xs text-text-neutral">{item.detail}</p>
          </article>
        ))}
      </section>

      <section id="bundle-layout" className="space-y-5 rounded-md border border-border-subtle bg-surface-white p-8">
        <div>
          <p className="font-provenance text-xs uppercase tracking-wide text-brand">Evidence package guide</p>
          <h2 className="mt-2 text-xl font-semibold text-text-institutional">Choose the Upload That Matches the Question</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-text-neutral">
            The Lab does not treat every upload as equally evidentiary. Start with a trade CSV or exchange export, use a rich trade CSV plus exact rules for the strongest self-serve result, and use a context ZIP when you want better provenance or Research Desk handoff quality.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {evidencePackages.map((item) => (
            <article key={item.name} className="rounded-md border border-border-subtle bg-surface-subtle p-4">
              <p className="font-provenance text-xs uppercase tracking-wide text-brand">{item.tier}</p>
              <h3 className="mt-2 text-base font-semibold text-text-institutional">{item.name}</h3>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-text-neutral">Files</dt>
                  <dd className="mt-1 text-text-graphite">{item.files}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-text-neutral">Unlocks</dt>
                  <dd className="mt-1 text-text-graphite">{item.unlocks}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-text-neutral">Boundary</dt>
                  <dd className="mt-1 text-text-neutral">{item.limits}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
        <div className="rounded-md border border-brand/25 bg-brand/5 p-4">
          <h3 className="text-sm font-semibold text-text-institutional">Reference bundle</h3>
          <p className="mt-1 text-sm leading-6 text-text-neutral">
            Download the reference ZIP to see the exact file names, root-level layout, manifest roles, broker export shape, claim format, benchmark context, and optional research-only files the app can inspect today. The values are synthetic and intended as a format guide.
          </p>
          <Link href={referenceBundleHref} className={cn(buttonVariants({ variant: "primary", size: "sm" }), "mt-3")}>
            Download Context ZIP Reference
          </Link>
        </div>
      </section>

      <section className="space-y-4 rounded-sm border border-border-subtle bg-surface-paper p-8">
        <h2 className="text-xl font-semibold text-text-institutional">Accepted Upload Types</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <article className="rounded-md border border-border-subtle p-4">
            <h3 className="text-sm font-semibold text-text-institutional">Trade CSV</h3>
            <p className="mt-2 text-xs text-text-neutral">Extension: <span className="font-mono">.csv</span></p>
            <p className="mt-2 text-sm text-text-neutral">Closed trades table resolved through canonical field aliases.</p>
            <p className="mt-2 text-xs text-text-neutral">Unlocks: prop evaluation preview, first breach, rolling windows, overview, distribution, monte carlo, ruin, report.</p>
            <p className="mt-2 text-xs text-text-neutral">For: fastest launch validation intake.</p>
          </article>
          <article className="rounded-md border border-border-subtle p-4">
            <h3 className="text-sm font-semibold text-text-institutional">Context bundle (bundle_v1)</h3>
            <p className="mt-2 text-xs text-text-neutral">Extension: <span className="font-mono">.zip</span></p>
            <p className="mt-2 text-sm text-text-neutral">ZIP with required <span className="font-mono">manifest.json</span> + <span className="font-mono">trades.csv</span>; optional metadata, assumptions, equity curve, broker export, benchmark, and claims.</p>
            <p className="mt-2 text-xs text-text-neutral">Unlocks: richer provenance, assumptions, execution context, and report quality where evidence supports it.</p>
            <p className="mt-2 text-xs text-text-neutral">For: users who want a cleaner audit packet without overclaiming advanced proof.</p>
          </article>
          <article className="rounded-md border border-border-subtle p-4">
            <h3 className="text-sm font-semibold text-text-institutional">Research Desk packet profile</h3>
            <p className="mt-2 text-xs text-text-neutral">Container: <span className="font-mono">bundle_v1</span> with <span className="font-mono">artifact_type: research_bundle</span></p>
            <p className="mt-2 text-sm text-text-neutral">Not a separate parser route; this is a manifest-level artifact profile under bundle_v1.</p>
            <p className="mt-2 text-xs text-text-neutral">Unlocks: stronger packet quality for reviewer handoff. True parameter stability, portfolio attribution, and broker-level realism route to Research Desk for launch.</p>
            <p className="mt-2 text-xs text-text-neutral">For: users supplying full contextual artifacts before deeper review.</p>
          </article>
        </div>
      </section>

      <section className="space-y-5 rounded-md border border-border-subtle bg-surface-white p-8">
        <div>
          <p className="font-provenance text-xs uppercase tracking-wide text-brand">Bundle Manifest v1</p>
          <h2 className="mt-2 text-xl font-semibold text-text-institutional">Optional Context ZIP Bundle Layout</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-text-neutral">
            Upload a root-level ZIP package when you want the Lab to read more than a trade table. The parser currently requires <span className="font-mono">manifest.json</span> and <span className="font-mono">trades.csv</span>. Other files improve prop-rule context, diagnostic confidence, provenance, or Research Desk packet quality.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-md border border-border-subtle bg-surface-subtle p-4">
            <h3 className="text-sm font-semibold text-text-institutional">Required files</h3>
            <ul className="mt-3 space-y-2 text-sm text-text-neutral">
              <li><span className="font-mono text-text-graphite">manifest.json</span> - declares bundle type, included files, optional roles, and provenance hints.</li>
              <li><span className="font-mono text-text-graphite">trades.csv</span> - canonical trade log with required trade fields.</li>
            </ul>
          </article>
          <article className="rounded-md border border-border-subtle bg-surface-subtle p-4">
            <h3 className="text-sm font-semibold text-text-institutional">Recognized optional files</h3>
            <ul className="mt-3 grid gap-2 text-sm text-text-neutral sm:grid-cols-2">
              <li><span className="font-mono">metadata.json</span></li>
              <li><span className="font-mono">equity_curve.csv</span></li>
              <li><span className="font-mono">assumptions.json</span></li>
              <li><span className="font-mono">params.json</span></li>
              <li><span className="font-mono">ohlcv.csv</span></li>
              <li><span className="font-mono">ohlcv.parquet</span></li>
              <li><span className="font-mono">benchmark.csv</span></li>
              <li><span className="font-mono">broker_export.csv</span></li>
              <li><span className="font-mono">declared_claims.json</span></li>
              <li><span className="font-mono">strategy_config.json</span></li>
              <li><span className="font-mono">backtest_report.json</span></li>
            </ul>
          </article>
        </div>

        <div className="rounded-md border border-amber-500/25 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          <p className="font-semibold">Current parser boundary</p>
          <p className="mt-1">
            <span className="font-mono">metadata.json</span>, <span className="font-mono">assumptions.json</span>, <span className="font-mono">params.json</span>, <span className="font-mono">ohlcv.csv</span>, <span className="font-mono">benchmark.csv</span>, <span className="font-mono">broker_export.csv</span>, and <span className="font-mono">declared_claims.json</span> are parsed today for context and packet quality. <span className="font-mono">ohlcv.parquet</span>, <span className="font-mono">strategy_config.json</span>, and <span className="font-mono">backtest_report.json</span> are recognized for manifest/provenance and future deeper parsing.
          </p>
        </div>

        <div className="rounded-md border border-research-red/20 bg-research-red/5 p-4 text-sm leading-6 text-text-graphite">
          <p className="font-semibold">Evidence honesty boundary</p>
          <p className="mt-1 text-text-neutral">
            Upload automation can validate what the submitted artifacts actually expose. When evidence is insufficient for true parameter stability, multi-asset regime attribution, broker-level execution realism, strategy reconstruction from a config/report, portfolio-level exposure analysis, or an independent validation memo, the correct path is Research Desk review rather than an overstated automated verdict.
          </p>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-text-neutral">Recommended context ZIP tree</h3>
          <CodeBlock>{`context_bundle.zip
  manifest.json
  trades.csv
  metadata.json
  assumptions.json
  benchmark.csv
  broker_export.csv
  equity_curve.csv
  declared_claims.json
  params.json
  ohlcv.csv
  strategy_config.json
  backtest_report.json
  parameter_results.csv
  run_manifest.json
  runs/
    run_001_trades.csv
    run_002_trades.csv`}</CodeBlock>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-text-neutral">Minimum manifest.json</h3>
          <CodeBlock>{`{
  "schema_version": "1.0",
  "bundle_type": "strategy_truth_room_bundle_v1",
  "contract_version": "1.0.0",
  "artifact_type": "trade_history_bundle",
  "strategy_name": "Momentum v2",
  "source_platform": "custom",
  "symbols": ["BTCUSDT", "ETHUSDT"],
  "timeframe": "1h",
  "market": "crypto",
  "exchange": "binance",
  "currency": "USD",
  "included_files": [
    "manifest.json",
    "trades.csv",
    "metadata.json",
    "assumptions.json",
    "params.json",
    "ohlcv.csv",
    "benchmark.csv",
    "broker_export.csv",
    "declared_claims.json"
  ]
}`}</CodeBlock>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-text-neutral">Research Desk manifest.json</h3>
          <CodeBlock>{`{
  "schema_version": "1.0",
  "bundle_type": "strategy_truth_room_bundle_v1",
  "contract_version": "1.0.0",
  "artifact_type": "research_bundle",
  "strategy_name": "Momentum v2",
  "source_platform": "custom",
  "symbols": ["BTCUSDT"],
  "timeframe": "1h",
  "market": "crypto",
  "exchange": "binance",
  "currency": "USD",
  "included_files": [
    "manifest.json",
    "trades.csv",
    "metadata.json",
    "assumptions.json",
    "params.json",
    "ohlcv.csv",
    "benchmark.csv",
    "broker_export.csv",
    "declared_claims.json",
    "parameter_results.csv",
    "run_manifest.json"
  ],
  "assumptions_present": true,
  "ohlcv_present": true,
  "parameter_metadata_present": true,
  "declared_claims_present": true,
  "broker_export_present": true,
  "files": [
    { "path": "trades.csv", "role": "trade_log_v1", "required": true },
    { "path": "metadata.json", "role": "strategy_truth_room_bundle_v1" },
    { "path": "assumptions.json", "role": "strategy_config_v1" },
    { "path": "params.json", "role": "parameter_sweep_v1" },
    { "path": "ohlcv.csv", "role": "ohlcv_context_v1" },
    { "path": "benchmark.csv", "role": "benchmark_series_v1" },
    { "path": "broker_export.csv", "role": "broker_export_v1" },
    { "path": "declared_claims.json", "role": "declared_claims_v1" },
    { "path": "parameter_results.csv", "role": "parameter_sweep_v1" },
    { "path": "run_manifest.json", "role": "parameter_sweep_v1" }
  ]
}`}</CodeBlock>
          <p className="text-xs text-text-neutral">Accepted <span className="font-mono">artifact_type</span> values are <span className="font-mono">trade_history_bundle</span>, <span className="font-mono">backtest_result_bundle</span>, and <span className="font-mono">research_bundle</span>.</p>
        </div>
      </section>

      <section className="space-y-5 rounded-md border border-border-subtle bg-surface-white p-8">
        <h2 className="text-xl font-semibold text-text-institutional">Trade CSV Specification</h2>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-text-neutral">Core required fields</h3>
          <SpecTable rows={requiredFields} required />
        </div>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-text-neutral">Optional fields — economics</h3>
          <SpecTable rows={optionalEconomicFields} />
        </div>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-text-neutral">Optional fields — excursion</h3>
          <SpecTable rows={optionalExcursionFields} />
        </div>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-text-neutral">Optional fields — risk</h3>
          <SpecTable rows={optionalRiskFields} />
        </div>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-text-neutral">Optional fields — metadata</h3>
          <SpecTable rows={optionalMetadataFields} />
        </div>
        <p className="text-xs text-text-neutral">Side normalization accepts long aliases (buy, long, b, bull) and short aliases (sell, short, s, bear).</p>
      </section>

      <section id="field-unlocks" className="space-y-4 rounded-md border border-border-subtle bg-surface-white p-8">
        <h2 className="text-xl font-semibold text-text-institutional">What Each Field Unlocks</h2>
        <div className="overflow-x-auto rounded-md border border-border-subtle">
          <table className="min-w-full divide-y divide-border-subtle text-sm">
            <thead className="bg-surface-panel/70 text-left text-xs uppercase tracking-wide text-text-neutral">
              <tr>
                <th className="px-4 py-3">Input richness</th>
                <th className="px-4 py-3">Primary unlocks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              <tr><td className="px-4 py-3 font-medium">Core trade fields</td><td className="px-4 py-3 text-text-neutral">Prop evaluation baseline, first breach, rolling windows, Overview, Distribution, Monte Carlo, Ruin, and Report available.</td></tr>
              <tr><td className="px-4 py-3 font-medium">Exact prop evaluation rules</td><td className="px-4 py-3 text-text-neutral">Decision-grade target-before-breach, daily-loss breach, total-drawdown breach, and rule-status interpretation.</td></tr>
              <tr><td className="px-4 py-3 font-medium">MAE/MFE</td><td className="px-4 py-3 text-text-neutral">Improved excursion interpretation and richer distribution context.</td></tr>
              <tr><td className="px-4 py-3 font-medium">risk_amount / stop_distance / R-multiples</td><td className="px-4 py-3 text-text-neutral">Stronger execution-quality framing and risk translation.</td></tr>
              <tr><td className="px-4 py-3 font-medium">Bundle assumptions.json</td><td className="px-4 py-3 text-text-neutral">Documents declared cost, slippage, and execution assumptions so the report can separate evidence from assumptions.</td></tr>
              <tr><td className="px-4 py-3 font-medium">Bundle params.json</td><td className="px-4 py-3 text-text-neutral">Improves baseline parameter context, but does not prove stability on its own.</td></tr>
              <tr><td className="px-4 py-3 font-medium">parameter_results.csv + run_manifest.json</td><td className="px-4 py-3 text-text-neutral">Improves Research Desk packet quality for Parameter Stability. Automated launch reports do not claim true stability from upload alone.</td></tr>
              <tr><td className="px-4 py-3 font-medium">Bundle ohlcv.csv / ohlcv.parquet</td><td className="px-4 py-3 text-text-neutral">Improves regime context and Research Desk packet quality. Automated launch reports do not claim multi-asset regime attribution from upload alone.</td></tr>
              <tr><td className="px-4 py-3 font-medium">Runtime account_size + risk_per_trade_pct</td><td className="px-4 py-3 text-text-neutral">Sizing-aware survivability interpretation for ruin diagnostics.</td></tr>
              <tr><td className="px-4 py-3 font-medium">Benchmark selection</td><td className="px-4 py-3 text-text-neutral">Benchmark-relative comparison diagnostics when benchmark data is available.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-5 rounded-md border border-border-subtle bg-surface-white p-8">
        <div>
          <p className="font-provenance text-xs uppercase tracking-wide text-brand">File examples</p>
          <h2 className="mt-2 text-xl font-semibold text-text-institutional">Optional Bundle File Schemas</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-text-neutral">Use these examples when building a test bundle. Keep files at the ZIP root unless the manifest explicitly declares a different path.</p>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-text-neutral">metadata.json</h3>
          <CodeBlock>{`{
  "strategy_name": "Momentum v2",
  "description": "Breakout continuation strategy on liquid crypto majors.",
  "author": "Your Name",
  "source_platform": "custom",
  "tags": ["momentum", "crypto", "1h"]
}`}</CodeBlock>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-text-neutral">assumptions.json</h3>
          <CodeBlock>{`{
  "slippage_model": "2 bps per side",
  "commission_model": "Binance taker fee 4 bps",
  "market_impact_model": "No explicit impact model; small order size assumed",
  "notes": "Trades are closed-trade PnL. Intraday equity was not exported."
}`}</CodeBlock>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-text-neutral">params.json</h3>
          <CodeBlock>{`{
  "parameter_set_name": "momentum_v2_base",
  "tunable_parameters": {
    "lookback": 40,
    "breakout_threshold": 1.8,
    "atr_stop": 2.5,
    "risk_per_trade_pct": 1
  },
  "optimization_target": "net_profit_to_drawdown"
}`}</CodeBlock>
          <p className="text-xs text-text-neutral">This improves parameter context but is not enough for automated stability. Add <span className="font-mono">parameter_results.csv</span> and <span className="font-mono">run_manifest.json</span> for a true sweep submission.</p>
        </div>

        <div className="space-y-3 rounded-md border border-border-subtle bg-surface-subtle p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-text-neutral">Research Desk parameter sweep packet</h3>
          <p className="text-sm leading-6 text-text-neutral">
            A single <span className="font-mono">params.json</span> describes one parameter set. It does not prove stability. A true parameter-stability submission needs multiple runs across nearby parameter combinations, explicit run IDs, per-run outcomes, and a mapping from every run to its parameters. Include per-run trade files under <span className="font-mono">runs/</span> when available so reviewers can audit whether the sweep changed only parameters or also changed the trading universe, date range, cost model, or execution rules.
          </p>
          <CodeBlock>{`parameter_results.csv
run_id,lookback,breakout_threshold,atr_stop,net_profit,max_drawdown,sharpe,trade_count
run_001,30,1.6,2.0,12500,-4200,1.1,185
run_002,40,1.8,2.5,11800,-3900,1.0,172

run_manifest.json
{
  "base_run_id": "run_002",
  "parameter_names": ["lookback", "breakout_threshold", "atr_stop"],
  "controlled_variables": {
    "universe": "BTCUSDT, ETHUSDT",
    "date_range": "2026-01-01 to 2026-03-31",
    "cost_model": "same fees and slippage for all runs"
  },
  "runs": [
    { "run_id": "run_001", "trades_file": "runs/run_001_trades.csv" },
    { "run_id": "run_002", "trades_file": "runs/run_002_trades.csv" }
  ]
}`}</CodeBlock>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-text-neutral">ohlcv.csv</h3>
            <CodeBlock>{`timestamp,symbol,open,high,low,close,volume
2026-01-05T10:00:00Z,BTCUSDT,43100,43200,43050,43125,1280`}</CodeBlock>
          </div>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-text-neutral">benchmark.csv</h3>
            <CodeBlock>{`timestamp,symbol,close
2026-01-05T10:00:00Z,BTCUSDT,43125`}</CodeBlock>
          </div>
        </div>

        <div className="space-y-3 rounded-md border border-border-subtle bg-surface-subtle p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-text-neutral">multi-asset ohlcv.csv guidance</h3>
          <p className="text-sm leading-6 text-text-neutral">
            Use one long CSV when the strategy trades multiple symbols. Every symbol in <span className="font-mono">trades.csv</span> should appear in OHLCV for the full trade window, timestamps should use one timezone and one bar interval, and symbols should match exactly. This can improve regime context, but portfolio-level multi-asset regime attribution still requires explicit coverage, timestamp alignment, and regime definitions. If any of those are ambiguous, route the case to Research Desk.
          </p>
          <CodeBlock>{`timestamp,symbol,open,high,low,close,volume
2026-01-05T10:00:00Z,BTCUSDT,43100,43200,43050,43125,1280
2026-01-05T10:00:00Z,ETHUSDT,2520,2535,2510,2528,9400
2026-01-05T11:00:00Z,BTCUSDT,43125,43310,43080,43260,1110
2026-01-05T11:00:00Z,ETHUSDT,2528,2542,2518,2537,8800`}</CodeBlock>
          <p className="text-xs text-text-neutral">
            If you already have regime labels, include them in a separate manifest or assumptions file with the rule definition, source columns, timezone, bar interval, and affected symbols. Upload labels should be treated as context, not proof, unless the rule is auditable.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-text-neutral">broker_export.csv</h3>
            <CodeBlock>{`timestamp,symbol,order_id,side,quantity,price,fee,fee_currency,liquidity
2026-01-05T10:00:01Z,BTCUSDT,O-001,buy,0.5,43125.5,6.75,USDT,taker`}</CodeBlock>
          </div>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-text-neutral">declared_claims.json</h3>
            <CodeBlock>{`[
  {
    "claim_id": "claim_1",
    "claim": "This strategy remains profitable after realistic costs.",
    "priority": "critical"
  },
  {
    "claim_id": "claim_2",
    "claim": "This strategy is suitable for a prop-firm evaluation.",
    "priority": "high"
  }
]`}</CodeBlock>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-md border border-border-subtle bg-surface-white p-8">
        <h2 className="text-xl font-semibold text-text-institutional">Runtime Assumptions You Can Set</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <article className="rounded-md border border-border-subtle p-4">
            <h3 className="text-sm font-semibold text-text-institutional">Exact prop rules</h3>
            <p className="mt-2 text-xs text-text-neutral">Recommended for launch. Used to compute first breach, target progress, rolling challenge windows, and rule-status truth.</p>
          </article>
          <article className="rounded-md border border-border-subtle p-4">
            <h3 className="text-sm font-semibold text-text-institutional">Account size</h3>
            <p className="mt-2 text-xs text-text-neutral">Optional positive number. Used for capital translation and survivability framing in risk diagnostics.</p>
          </article>
          <article className="rounded-md border border-border-subtle p-4">
            <h3 className="text-sm font-semibold text-text-institutional">Risk per trade %</h3>
            <p className="mt-2 text-xs text-text-neutral">Optional positive percent. Used in sizing-aware ruin/survivability interpretation.</p>
          </article>
          <article className="rounded-md border border-border-subtle p-4">
            <h3 className="text-sm font-semibold text-text-institutional">Benchmark</h3>
            <p className="mt-2 text-xs text-text-neutral">Optional but useful for relative performance framing when benchmark data is available.</p>
          </article>
        </div>
        <p className="text-xs text-text-neutral">Runtime assumptions enrich interpretation; they do not replace missing trade-level fields.</p>
      </section>

      <section className="space-y-3 rounded-md border border-border-subtle bg-surface-white p-8">
        <h2 className="text-xl font-semibold text-text-institutional">Benchmark Selection</h2>
        <ul className="space-y-2 text-sm text-text-neutral">
          <li>• Supported benchmark IDs: BTC, SPY, XAUUSD, DXY.</li>
          <li>• Modes: Auto (asset-class inference), Manual (explicit benchmark ID), None (disable benchmark comparison).</li>
          <li>• Auto maps: crypto→BTC, equities→SPY, metals→XAUUSD, macro/fx→DXY. Unknown detection keeps benchmark disabled.</li>
          <li>• Engine comparison uses daily frequency, intersection window alignment, and normalization basis <span className="font-mono">100_at_first_common_timestamp</span>.</li>
          <li>• If selected benchmark dataset is missing, benchmark is automatically disabled for that run.</li>
        </ul>
      </section>

      <section className="space-y-3 rounded-md border border-border-subtle bg-surface-white p-8">
        <h2 className="text-xl font-semibold text-text-institutional">Example Rich Trade CSV</h2>
        <div className="overflow-x-auto rounded-md border border-border-subtle bg-surface-panel/50 p-4 text-xs text-text-graphite">
          <pre className="whitespace-pre">symbol,side,entry_time,exit_time,entry_price,exit_price,quantity,pnl,pnl_pct,fees,mae,mfe,risk_amount,stop_distance,r_multiple,strategy_name,timeframe,market,exchange,trade_id\nBTCUSDT,long,2026-01-05T10:00:00Z,2026-01-05T14:30:00Z,43125.5,43520.0,0.5,197.25,0.92,6.75,-120.0,320.0,1000,80,1.75,momentum_v2,1h,crypto,binance,T-2026-001\nETHUSDT,short,2026-01-07T09:15:00Z,2026-01-07T12:45:00Z,2520.0,2478.0,2.0,84.0,1.67,5.8,-48.0,112.0,900,45,1.40,momentum_v2,1h,crypto,binance,T-2026-002</pre>
        </div>
      </section>

      <section className="space-y-3 rounded-md border border-border-subtle bg-surface-white p-8">
        <h2 className="text-xl font-semibold text-text-institutional">How to Get the Best Analysis</h2>
        <ul className="space-y-2 text-sm text-text-neutral">
          <li>• Keep timestamps UTC-consistent and machine-parseable.</li>
          <li>• Avoid mixed conventions across rows (symbols, side labels, number formats).</li>
          <li>• Include MAE/MFE whenever available.</li>
          <li>• Include risk_amount and/or R-multiples for stronger risk diagnostics.</li>
          <li>• Set benchmark, account size, and risk per trade % for decision-grade survivability interpretation.</li>
          <li>• Keep one strategy per upload for launch self-serve. Use Research Desk for multi-run parameter sweeps or portfolio-level review.</li>
          <li>• For multi-asset OHLCV, include every traded symbol for the full trade window with exact symbol matching and one timestamp convention.</li>
        </ul>
      </section>

      <section className="space-y-3 rounded-md border border-border-subtle bg-surface-white p-8">
        <h2 className="text-xl font-semibold text-text-institutional">Current Limits</h2>
        <ul className="space-y-2 text-sm text-text-neutral">
          <li>• Upload intake currently accepts only <span className="font-mono">.csv</span> and <span className="font-mono">.zip</span>. Server-side size limits are enforced by account plan; the public client blocks oversized files before upload.</li>
          <li>• Upload inspection, analysis creation, exports, sharing, and Research Desk requests are protected by route-level rate limits.</li>
          <li>• Artifact kinds are currently limited to trade CSV, exchange-export-like CSVs that normalize to trades, and bundle_v1 context ZIPs.</li>
          <li>• Parameter Stability is a Research Desk scope for launch. A single params file adds context but does not prove stability; true stability requires a multi-run sweep and reviewer validation.</li>
          <li>• Regime attribution is a Research Desk scope for launch. Multi-asset attribution requires symbol coverage, timestamp alignment, and explicit regime definitions.</li>
          <li>• Execution diagnostics can remain limited without richer assumptions/context artifacts. Broker-level realism requires broker fills, fee/spread evidence, and often Research Desk review.</li>
          <li>• Strategy reconstruction from configs/reports, portfolio-level exposure analysis, and independent validation memos are Research Desk scopes when the upload evidence is incomplete.</li>
        </ul>
      </section>

      <section className="rounded-md border border-brand/25 bg-brand/5 p-6">
        <h2 className="text-lg font-semibold text-text-institutional">Ready to run?</h2>
        <p className="mt-1 text-sm text-text-neutral">Use this specification to package your next upload, then return to the lab intake.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/app/new-analysis" className={buttonVariants({ variant: "primary" })}>Start New Analysis</Link>
          <Link href="/robustness-lab" className={cn(buttonVariants({ variant: "secondary" }))}>Back to Lab</Link>
        </div>
      </section>
    </main>
    </PublicShell>
  );
}
