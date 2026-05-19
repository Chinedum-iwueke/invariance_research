import { ChartCard } from "@/components/charts/chart-card";
import { MockHeatmap, MockHistogram, MockLineChart, MockMultiMetricPanel } from "@/components/charts/chart-mocks";
import { EvidenceStatePanel, EvidenceStatusBadge } from "@/components/dashboard/evidence-status";
import { MetricRow } from "@/components/dashboard/metric-row";
import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";

const palette = [
  ["Research Red", "#B00020", "Brand, active evidence, contradiction"],
  ["Ink", "#11100F", "Primary text"],
  ["Carbon", "#272321", "Section headings"],
  ["Bone", "#FBFAF7", "App background"],
  ["Porcelain", "#F4F1EC", "Panels and rails"],
  ["Rule", "#DED8D1", "Dividers"],
];

const evidenceStates = [
  { state: "supported" as const, title: "Supported", body: "The artifact and engine output support this conclusion.", reasonCode: "evidence.supported" },
  { state: "limited" as const, title: "Limited", body: "The evidence supports a weaker claim with explicit caveats.", reasonCode: "evidence.limited" },
  { state: "unsupported" as const, title: "Unsupported", body: "The artifact does not contain enough information for this claim.", reasonCode: "evidence.unsupported" },
  { state: "contradicted" as const, title: "Contradicted", body: "The emitted diagnostics conflict with the strategy claim.", reasonCode: "evidence.contradicted" },
];

const diagnosticRows = [
  ["Execution realism", "limited", "Requires explicit slippage and fee assumptions", "Upload execution assumptions"],
  ["Regime sensitivity", "unsupported", "OHLCV or labeled regime context missing", "Upload market context"],
  ["Monte Carlo survivability", "supported", "Trade path supports simulation envelope", "Review drawdown tail"],
  ["Parameter stability", "locked", "Evidence may support it; plan does not include view", "Upgrade or export report"],
] as const;

const metrics = [
  { label: "Robustness Score", value: "74", tone: "positive" as const, helper: "Supported by overview, distribution, Monte Carlo, and ruin diagnostics." },
  { label: "Execution Edge Decay", value: "38%", tone: "warning" as const, helper: "Limited because fee/slippage assumptions were inferred rather than uploaded." },
  { label: "Ruin Probability", value: "11.8%", tone: "warning" as const, helper: "Review before scaling capital; threshold target is below 8%." },
  { label: "Regime Coverage", value: "N/A", tone: "neutral" as const, helper: "Unsupported until market-context artifact is supplied." },
];

function toEvidenceStatus(status: string) {
  if (status === "supported") return "supported" as const;
  if (status === "limited") return "limited" as const;
  if (status === "locked") return "locked" as const;
  return "unsupported" as const;
}

export default function UIKitPage() {
  return (
    <main className="bg-surface-white">
      <Navbar links={[{ label: "System", href: "#system" }, { label: "Evidence", href: "#evidence" }, { label: "Workbench", href: "#workbench" }, { label: "Charts", href: "#charts" }]} sticky={false} />

      <section id="system" className="container-shell space-y-10 py-section-lg">
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
          <div className="space-y-5">
            <p className="eyebrow text-brand">Forensic Research Desk</p>
            <h1 className="font-display max-w-4xl text-[clamp(3rem,7vw,5.75rem)] leading-[0.95] tracking-normal text-text-institutional">Evidence before conviction.</h1>
            <p className="max-w-2xl text-base leading-8 text-text-neutral md:text-lg">A design language for strategy validation as an evidentiary record: forensic, exacting, report-ready, and anchored by research red.</p>
            <div className="flex flex-wrap gap-3">
              <Button>Generate report</Button>
              <Button variant="secondary">View evidence ledger</Button>
              <Button variant="tertiary">Request deeper validation</Button>
            </div>
          </div>
          <Card className="artifact-surface p-6">
            <div className="flex items-start justify-between gap-4 border-b border-border-subtle pb-4">
              <div>
                <p className="font-provenance text-[11px] uppercase tracking-[0.12em] text-text-neutral">Report snapshot / v03</p>
                <h2 className="font-display mt-2 text-3xl leading-tight tracking-normal text-text-institutional">Strategy claim under review</h2>
              </div>
              <EvidenceStatusBadge state="limited" />
            </div>
            <p className="mt-5 text-sm leading-7 text-text-neutral">The strategy remains conditional: core performance evidence is present, but execution and regime claims are not fully supported by the uploaded artifact.</p>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          {palette.map(([name, value, usage]) => (
            <div key={name} className="rounded-md border border-border-subtle bg-surface-paper p-4 shadow-soft">
              <div className="h-16 rounded-sm border border-border-subtle" style={{ backgroundColor: value }} />
              <p className="mt-3 text-sm font-semibold text-text-graphite">{name}</p>
              <p className="font-provenance text-xs text-text-muted">{value}</p>
              <p className="mt-2 text-xs leading-relaxed text-text-neutral">{usage}</p>
            </div>
          ))}
        </div>

        <Card className="grid gap-6 p-card-lg md:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="eyebrow">Typography</p>
            <h2 className="font-display mt-2 text-5xl leading-none tracking-normal">Instrument Serif for artifact gravity.</h2>
          </div>
          <div className="space-y-3">
            <p className="text-xl font-semibold text-text-institutional">IBM Plex Sans carries the product interface.</p>
            <p className="text-base leading-7 text-text-neutral">Dense, precise, and humane enough for analysis flows, forms, dashboards, and report prose.</p>
            <p className="font-provenance rounded-sm border border-border-subtle bg-surface-subtle px-3 py-2 text-sm text-text-graphite">IBM Plex Mono: seam=v1 / parser=v2 / snapshot=report_03</p>
          </div>
        </Card>
      </section>

      <section id="evidence" className="border-y border-border-subtle bg-surface-panel/65">
        <div className="container-shell space-y-8 py-section-lg">
          <SectionHeader eyebrow="Evidence states" title="Unsupported is designed, not hidden." description="Evidence status is a core product primitive across upload, analysis, report, and share contexts." />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {evidenceStates.map((item) => <EvidenceStatePanel key={item.state} {...item} nextAction="Follow the ledger" />)}
          </div>

          <Card className="overflow-hidden p-0">
            <div className="border-b border-border-subtle bg-surface-subtle px-5 py-4">
              <p className="eyebrow">Evidence ledger matrix</p>
              <h3 className="mt-1 text-lg font-semibold text-text-institutional">Claim support map</h3>
            </div>
            <div className="divide-y divide-border-subtle">
              {diagnosticRows.map(([claim, status, reason, action]) => (
                <div key={claim} className="grid gap-3 px-5 py-4 text-sm md:grid-cols-[1fr_150px_1.5fr_1fr] md:items-center">
                  <p className="font-semibold text-text-graphite">{claim}</p>
                  <EvidenceStatusBadge state={toEvidenceStatus(status)} compact />
                  <p className="text-text-neutral">{reason}</p>
                  <p className="font-medium text-text-graphite">{action}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      <section id="workbench" className="container-shell space-y-8 py-section-lg">
        <SectionHeader eyebrow="Workbench" title="Metric cards become evidence instruments." description="Each value carries status, source, and limitation context instead of floating as a generic stat." />
        <MetricRow metrics={metrics} cols={4} />
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="p-card-lg">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border-subtle pb-4">
              <div>
                <p className="eyebrow">Verdict strip</p>
                <h3 className="mt-2 text-2xl font-semibold text-text-institutional">Conditional validation, execution evidence incomplete.</h3>
              </div>
              <EvidenceStatusBadge state="limited" />
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <EvidenceStatePanel state="supported" title="Strongest support" body="Monte Carlo and distribution diagnostics agree on survivability under uploaded trade path." />
              <EvidenceStatePanel state="limited" title="Strongest doubt" body="Execution realism depends on inferred costs rather than uploaded assumptions." />
              <EvidenceStatePanel state="unsupported" title="Next experiment" body="Upload market context to test regime sensitivity and benchmark-relative claims." />
            </div>
          </Card>
          <Card className="artifact-surface p-card-lg">
            <p className="font-provenance text-[11px] uppercase tracking-[0.12em] text-text-neutral">Share-safe report preview</p>
            <h3 className="font-display mt-2 text-4xl tracking-normal">No raw uploads. No hidden confidence.</h3>
            <p className="mt-4 text-sm leading-7 text-text-neutral">Shared reports use allowlisted fields, immutable snapshots, visible limitations, and report-safe evidence summaries.</p>
          </Card>
        </div>
      </section>

      <section id="charts" className="border-t border-border-subtle bg-surface-subtle">
        <div className="container-shell space-y-6 py-section-lg">
          <SectionHeader eyebrow="Chart grammar" title="Charts answer evidence questions." description="Diagnostic visuals carry provenance, limitation state, and semantic color rather than generic dashboard styling." />
          <div className="grid gap-6">
            <ChartCard title="Does the strategy outperform the benchmark after normalization?" subtitle="Source: overview diagnostic / benchmark comparison" chart={<MockLineChart />} footer="Research red is strategy. Blue is benchmark. Divergence windows mark periods requiring closer review." />
            <div className="grid gap-6 md:grid-cols-2">
              <ChartCard title="Where is payoff concentration hiding?" subtitle="Distribution diagnostic" chart={<MockHistogram />} />
              <ChartCard title="Which regimes contradict the claim?" subtitle="Regime sensitivity diagnostic" chart={<MockHeatmap />} />
            </div>
            <ChartCard title="Evidence coverage by diagnostic family" subtitle="Availability, limitation, and unsupported states" chart={<MockMultiMetricPanel />} />
          </div>
        </div>
      </section>

      <Footer groups={[{ title: "Navigation", links: [{ label: "Home", href: "/" }, { label: "UI Kit", href: "/ui-kit" }] }, { title: "System", links: [{ label: "Evidence", href: "#evidence" }, { label: "Workbench", href: "#workbench" }] }]} />
    </main>
  );
}
