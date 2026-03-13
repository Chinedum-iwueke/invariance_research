import type { OverviewDiagnostic } from "@/lib/contracts";
import type { RawOverviewResult } from "@/lib/server/adapters/bulletproof/types";

export function mapRawOverviewToOverviewDiagnostic(raw?: RawOverviewResult): OverviewDiagnostic {
  return {
    metrics: [
      { label: "Robustness Score", value: raw?.score ? `${raw.score} / 100` : "N/A", band: "moderate" },
      { label: "Overfitting Risk", value: raw?.overfittingRiskPct ? `${raw.overfittingRiskPct}%` : "N/A", band: "elevated" },
    ],
    figure: {
      figure_id: "overview-equity-comparison",
      title: "Equity Comparison",
      type: "line",
      series: (raw?.figureSeries ?? []).map((series) => ({
        key: series.key,
        label: series.label,
        series_type: "line",
        points: series.points,
      })),
      x_label: "Path Step",
      y_label: "Equity",
    },
    interpretation: {
      title: "Overview Interpretation",
      summary: "Placeholder adapter output until bulletproof_bt package integration is wired.",
    },
    verdict: {
      status: "moderate",
      title: "Preliminary robustness profile",
      summary: "Adapter scaffold only. Replace with normalized verdict logic during engine integration.",
    },
  };
}
