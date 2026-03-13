import type { MonteCarloDiagnostic } from "@/lib/contracts";
import type { RawMonteCarloResult } from "@/lib/server/adapters/bulletproof/types";

export function mapRawMonteCarloToMonteCarloDiagnostic(raw?: RawMonteCarloResult): MonteCarloDiagnostic {
  return {
    metrics: [
      { label: "Worst Simulated Drawdown", value: raw?.worstDrawdownPct ? `${raw.worstDrawdownPct}%` : "N/A", band: "critical" },
      { label: "Probability of Ruin", value: raw?.ruinProbabilityPct ? `${raw.ruinProbabilityPct}%` : "N/A", band: "elevated" },
    ],
    figure: {
      figure_id: "monte-carlo-fan",
      title: "Monte Carlo Equity Fan",
      type: "fan",
      series: raw?.medianPath
        ? [
            {
              key: "median",
              label: "Median Path",
              series_type: "line",
              points: raw.medianPath,
            },
          ]
        : [],
      x_label: "Simulation Step",
      y_label: "Equity",
    },
    interpretation: {
      title: "Monte Carlo Interpretation",
      summary: "Placeholder Monte Carlo interpretation pending true backend mapping.",
    },
    warnings: (raw?.warnings ?? []).map((warning) => ({
      code: warning.code,
      severity: "warning",
      title: warning.code,
      message: warning.message,
    })),
  };
}
