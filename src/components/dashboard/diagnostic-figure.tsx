"use client";

import type { FigurePayload } from "@/lib/contracts";
import { EChartsHost } from "@/components/charts/echarts-host";
import { adaptFigureToECharts } from "@/lib/charts/adapters";

function provenanceLabel(value: FigurePayload["provenance"] | undefined): string {
  if (value === "engine_native") return "Engine-native";
  if (value === "adapter_normalized") return "Adapter-normalized";
  if (value === "synthesized_fallback") return "Synthesized fallback";
  if (value === "reconstructed_from_trades") return "Reconstructed from persisted trades";
  return "Unknown provenance";
}

export function DiagnosticFigure({ figure, emptyMessage, height = 500 }: { figure?: FigurePayload; emptyMessage?: string; height?: number }) {
  const { adapted, rendererSupported, emptyReason } = adaptFigureToECharts(figure);

  if (!figure || !adapted) {
    console.log("[analysis-page-debug]", {
      scope: "analysis-page-debug",
      component: "DiagnosticFigure",
      branch: "empty_state_branch",
      renderer_supported: rendererSupported,
      figure_type: figure?.type ?? null,
      empty_state_reason: emptyReason,
    });

    return (
      <p className="rounded-sm border border-dashed border-border-subtle bg-surface-panel p-4 text-sm text-text-neutral">
        {emptyMessage ?? "No chart series were emitted for this diagnostic in the persisted run payload."}
      </p>
    );
  }

  console.log("[analysis-page-debug]", {
    scope: "analysis-page-debug",
    component: "DiagnosticFigure",
    branch: "rendered",
    figure_id: figure.figure_id,
    figure_type: figure.type,
    series_count: adapted.summary.length,
  });

  return (
    <div className="space-y-3 rounded-sm border border-border-subtle p-3 lg:p-4">
      <EChartsHost option={adapted.option} height={height} />

      <div className="grid gap-2 text-xs text-text-neutral md:grid-cols-2">
        <p><span className="font-medium text-text-graphite">X-axis:</span> {figure.x_label ?? "Not emitted"}</p>
        <p><span className="font-medium text-text-graphite">Y-axis:</span> {figure.y_label ?? "Not emitted"}</p>
        <p><span className="font-medium text-text-graphite">Series:</span> {adapted.summary.map((item) => item.label).join(", ")}</p>
        <p><span className="font-medium text-text-graphite">Provenance:</span> {provenanceLabel(figure.provenance)}</p>
      </div>

      {figure.note || adapted.note ? (
        <p className="rounded-sm border border-border-subtle bg-surface-panel px-2.5 py-2 text-xs text-text-neutral">
          <span className="font-medium text-text-graphite">Method note:</span> {figure.note ?? adapted.note}
        </p>
      ) : null}
    </div>
  );
}
