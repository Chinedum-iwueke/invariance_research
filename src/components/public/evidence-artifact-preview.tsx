import { Activity, FileCheck2, LockKeyhole, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type ArtifactPreviewProps = {
  variant?: "lab" | "report" | "desk" | "legal";
  className?: string;
};

const variantCopy = {
  lab: {
    label: "LAB SNAPSHOT",
    title: "Strategy claim: survives deployment friction",
    score: "74",
    status: "LIMITED SUPPORT",
    rows: [
      ["Execution drag", "Supported", "3.8% degradation"],
      ["Monte Carlo", "Supported", "1,000 paths"],
      ["Regime evidence", "Limited", "Context missing"],
      ["Ruin boundary", "Supported", "Sizing sensitive"],
    ],
  },
  report: {
    label: "REPORT ARTIFACT",
    title: "Committee-ready validation record",
    score: "A-",
    status: "EXPORT READY",
    rows: [
      ["Evidence received", "Supported", "Trade CSV + assumptions"],
      ["Claim ledger", "Supported", "8 diagnostics"],
      ["Limitations", "Limited", "2 unresolved"],
      ["Provenance", "Supported", "Engine v1 envelope"],
    ],
  },
  desk: {
    label: "RESEARCH DESK",
    title: "Hypothesis to audited experiment",
    score: "12",
    status: "ACTIVE THREADS",
    rows: [
      ["Idea formalization", "Supported", "Claim drafted"],
      ["Experiment queue", "Supported", "3 next tests"],
      ["Memory links", "Limited", "Early access"],
      ["Contradictions", "Supported", "2 found"],
    ],
  },
  legal: {
    label: "TRUST RECORD",
    title: "Confidential artifact handling",
    score: "V1",
    status: "POLICY SURFACE",
    rows: [
      ["Uploaded artifacts", "Protected", "Restricted use"],
      ["AI assistance", "Disclosed", "Human review"],
      ["Strategy data", "Confidential", "No resale"],
      ["Terms", "Current", "May 2026"],
    ],
  },
} as const;

export function EvidenceArtifactPreview({ variant = "lab", className }: ArtifactPreviewProps) {
  const copy = variantCopy[variant];

  return (
    <div className={cn("artifact-surface public-artifact-preview relative overflow-hidden p-4 md:p-5", className)}>
      <div className="absolute inset-x-0 top-0 h-1 bg-brand" />
      <div className="flex items-start justify-between gap-4 border-b border-border-subtle pb-4">
        <div className="min-w-0 space-y-2">
          <p className="font-provenance text-[10px] uppercase tracking-[0.14em] text-brand">{copy.label}</p>
          <h3 className="max-w-sm text-base font-semibold leading-tight text-text-institutional md:text-lg">{copy.title}</h3>
        </div>
        <div className="shrink-0 rounded-sm border border-border-strong bg-surface-panel px-3 py-2 text-right">
          <p className="font-provenance text-2xl leading-none text-text-institutional">{copy.score}</p>
          <p className="mt-1 font-provenance text-[9px] uppercase tracking-[0.12em] text-text-neutral">{copy.status}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        {copy.rows.map(([name, status, detail]) => (
          <div key={name} className="grid grid-cols-[1fr_auto] gap-3 border-b border-border-subtle/70 pb-2 last:border-b-0 last:pb-0">
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight text-text-graphite">{name}</p>
              <p className="mt-1 font-provenance text-[10px] uppercase tracking-[0.08em] text-text-neutral">{detail}</p>
            </div>
            <span
              className={cn(
                "h-fit rounded-sm border px-2 py-1 font-provenance text-[10px] uppercase tracking-[0.08em]",
                status === "Supported" || status === "Protected" || status === "Current" || status === "Disclosed"
                  ? "border-evidence-supported/25 bg-evidence-supported-wash text-evidence-supported"
                  : "border-evidence-limited/25 bg-evidence-limited-wash text-evidence-limited",
              )}
            >
              {status}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 border-t border-border-subtle pt-3 text-text-neutral">
        <div className="flex items-center gap-1.5 font-provenance text-[10px] uppercase tracking-[0.08em]">
          <FileCheck2 className="h-3.5 w-3.5 text-brand" />
          Traceable
        </div>
        <div className="flex items-center gap-1.5 font-provenance text-[10px] uppercase tracking-[0.08em]">
          <ShieldCheck className="h-3.5 w-3.5 text-evidence-supported" />
          Reviewed
        </div>
        <div className="flex items-center gap-1.5 font-provenance text-[10px] uppercase tracking-[0.08em]">
          {variant === "legal" ? <LockKeyhole className="h-3.5 w-3.5 text-text-neutral" /> : <Activity className="h-3.5 w-3.5 text-chart-benchmark" />}
          {variant === "legal" ? "Private" : "Live"}
        </div>
      </div>
    </div>
  );
}
