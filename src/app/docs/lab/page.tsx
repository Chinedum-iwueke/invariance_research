import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Strategy Robustness Lab Docs",
  description: "Canonical upload specification for Strategy Robustness Lab artifacts, fields, aliases, and runtime assumptions.",
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

export default function LabDocsPage() {
  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-12 lg:px-10">
      <section className="space-y-4 rounded-md border border-border-subtle bg-surface-white p-8">
        <div className="h-1 w-20 rounded-full bg-brand" />
        <p className="inline-flex rounded-full border border-brand/30 bg-brand/5 px-3 py-1 text-xs font-medium uppercase tracking-wide text-brand">Canonical Upload Specification</p>
        <h1 className="text-3xl font-semibold tracking-tight text-text-institutional">Strategy Robustness Lab Docs</h1>
        <p className="text-base text-text-neutral">Accepted upload formats, supported fields, runtime assumptions, and what each artifact unlocks.</p>
        <p className="max-w-4xl text-sm text-text-neutral">
          The lab can analyze multiple artifact classes, but richer uploads unlock deeper diagnostics and stronger interpretation fidelity. Treat this page as the canonical upload and runtime specification for Strategy Robustness Lab.
        </p>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[{
          label: "Minimum",
          value: "Trade CSV",
          detail: "Canonical core trade fields only",
        }, {
          label: "Recommended",
          value: "Rich trade CSV",
          detail: "Add MAE/MFE + risk + R fields",
        }, {
          label: "Richest accepted",
          value: "bundle_v1 ZIP",
          detail: "trades + metadata + assumptions + params + optional OHLCV",
        }, {
          label: "Runtime assumptions",
          value: "Benchmark + account size + risk %",
          detail: "Set before running analysis",
        }].map((item) => (
          <article key={item.label} className="rounded-md border border-border-subtle bg-surface-white p-4">
            <p className="text-xs uppercase tracking-wide text-text-neutral">{item.label}</p>
            <p className="mt-1 text-sm font-semibold text-text-institutional">{item.value}</p>
            <p className="mt-1 text-xs text-text-neutral">{item.detail}</p>
          </article>
        ))}
      </section>

      <section className="space-y-4 rounded-md border border-border-subtle bg-surface-white p-8">
        <h2 className="text-xl font-semibold text-text-institutional">Accepted Upload Types</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <article className="rounded-md border border-border-subtle p-4">
            <h3 className="text-sm font-semibold text-text-institutional">Trade CSV</h3>
            <p className="mt-2 text-xs text-text-neutral">Extension: <span className="font-mono">.csv</span></p>
            <p className="mt-2 text-sm text-text-neutral">Closed trades table resolved through canonical field aliases.</p>
            <p className="mt-2 text-xs text-text-neutral">Unlocks: overview, distribution, monte carlo, ruin, report (execution/regimes may be limited).</p>
            <p className="mt-2 text-xs text-text-neutral">For: fastest baseline validation intake.</p>
          </article>
          <article className="rounded-md border border-border-subtle p-4">
            <h3 className="text-sm font-semibold text-text-institutional">Structured bundle (bundle_v1)</h3>
            <p className="mt-2 text-xs text-text-neutral">Extension: <span className="font-mono">.zip</span></p>
            <p className="mt-2 text-sm text-text-neutral">ZIP with required <span className="font-mono">manifest.json</span> + <span className="font-mono">trades.csv</span>; optional metadata/assumptions/params/OHLCV files.</p>
            <p className="mt-2 text-xs text-text-neutral">Unlocks: richer eligibility and context-aware diagnostics.</p>
            <p className="mt-2 text-xs text-text-neutral">For: institutional upload workflows and reproducibility.</p>
          </article>
          <article className="rounded-md border border-border-subtle p-4">
            <h3 className="text-sm font-semibold text-text-institutional">Research bundle profile</h3>
            <p className="mt-2 text-xs text-text-neutral">Container: <span className="font-mono">bundle_v1</span> with <span className="font-mono">artifact_type: research_bundle</span></p>
            <p className="mt-2 text-sm text-text-neutral">Not a separate parser route; this is a manifest-level artifact profile under bundle_v1.</p>
            <p className="mt-2 text-xs text-text-neutral">Unlocks: full diagnostic availability when artifact richness is classified as <span className="font-mono">research_complete</span>.</p>
            <p className="mt-2 text-xs text-text-neutral">For: teams supplying full contextual artifacts.</p>
          </article>
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

      <section className="space-y-4 rounded-md border border-border-subtle bg-surface-white p-8">
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
              <tr><td className="px-4 py-3 font-medium">Core trade fields</td><td className="px-4 py-3 text-text-neutral">Overview, Distribution, Monte Carlo, Ruin, Report available.</td></tr>
              <tr><td className="px-4 py-3 font-medium">MAE/MFE</td><td className="px-4 py-3 text-text-neutral">Improved excursion interpretation and richer distribution context.</td></tr>
              <tr><td className="px-4 py-3 font-medium">risk_amount / stop_distance / R-multiples</td><td className="px-4 py-3 text-text-neutral">Stronger execution-quality framing and risk translation.</td></tr>
              <tr><td className="px-4 py-3 font-medium">Bundle assumptions.json</td><td className="px-4 py-3 text-text-neutral">Execution diagnostic can move from limited to available.</td></tr>
              <tr><td className="px-4 py-3 font-medium">Bundle params.json</td><td className="px-4 py-3 text-text-neutral">Stability can move from limited/unavailable toward available.</td></tr>
              <tr><td className="px-4 py-3 font-medium">Bundle ohlcv.csv / ohlcv.parquet</td><td className="px-4 py-3 text-text-neutral">Regimes can move from limited/unavailable toward available.</td></tr>
              <tr><td className="px-4 py-3 font-medium">Runtime account_size + risk_per_trade_pct</td><td className="px-4 py-3 text-text-neutral">Sizing-aware survivability interpretation for ruin diagnostics.</td></tr>
              <tr><td className="px-4 py-3 font-medium">Benchmark selection</td><td className="px-4 py-3 text-text-neutral">Benchmark-relative comparison diagnostics when benchmark data is available.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4 rounded-md border border-border-subtle bg-surface-white p-8">
        <h2 className="text-xl font-semibold text-text-institutional">Runtime Assumptions You Can Set</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <article className="rounded-md border border-border-subtle p-4">
            <h3 className="text-sm font-semibold text-text-institutional">Benchmark</h3>
            <p className="mt-2 text-xs text-text-neutral">Optional but recommended for relative performance framing. Used to configure benchmark comparison diagnostics.</p>
          </article>
          <article className="rounded-md border border-border-subtle p-4">
            <h3 className="text-sm font-semibold text-text-institutional">Account size</h3>
            <p className="mt-2 text-xs text-text-neutral">Optional positive number. Used for capital translation and survivability framing in risk diagnostics.</p>
          </article>
          <article className="rounded-md border border-border-subtle p-4">
            <h3 className="text-sm font-semibold text-text-institutional">Risk per trade %</h3>
            <p className="mt-2 text-xs text-text-neutral">Optional positive percent. Used in sizing-aware ruin/survivability interpretation.</p>
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
          <li>• Keep one strategy per upload unless your bundle is explicitly structured for multi-run parameter analysis.</li>
        </ul>
      </section>

      <section className="space-y-3 rounded-md border border-border-subtle bg-surface-white p-8">
        <h2 className="text-xl font-semibold text-text-institutional">Current Limits</h2>
        <ul className="space-y-2 text-sm text-text-neutral">
          <li>• Upload intake currently accepts only <span className="font-mono">.csv</span> and <span className="font-mono">.zip</span>, up to 10MB.</li>
          <li>• Artifact kinds are currently limited to trade CSV and bundle_v1.</li>
          <li>• Parameter Stability is unavailable for trade-only uploads and requires parameter metadata/bundle context.</li>
          <li>• Regimes diagnostics require OHLCV/regime context for full availability.</li>
          <li>• Execution diagnostics can remain limited without richer assumptions/context artifacts.</li>
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
  );
}
