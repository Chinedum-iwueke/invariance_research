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

export function DiagnosticFigure({ figure, emptyMessage, height = 480 }: { figure?: FigurePayload; emptyMessage?: string; height?: number }) {
  const { adapted, rendererSupported, emptyReason } = adaptFigureToECharts(figure);
  const hasSeries = Array.isArray(figure?.series) && figure.series.length > 0;
  const hasGroups = Array.isArray(figure?.groups) && figure.groups.length > 0;

  if (!figure || !adapted) {
    if (!figure) {
      return (
        <p className="rounded-sm border border-dashed border-border-subtle bg-surface-panel p-4 text-sm text-text-neutral">
          {emptyMessage ?? "No chart series were emitted for this diagnostic in the persisted run payload."}
        </p>
      );
    }

    return (
      <div className="space-y-2 rounded-sm border border-dashed border-border-subtle bg-surface-panel p-3 text-xs text-text-neutral">
        <p className="font-medium text-text-graphite">Chart unavailable for this figure payload.</p>
        <p><span className="font-medium text-text-graphite">Figure ID:</span> {figure.figure_id || "Unavailable"}</p>
        <p><span className="font-medium text-text-graphite">Figure type:</span> {figure.type || "Unavailable"}</p>
        <p><span className="font-medium text-text-graphite">Series empty:</span> {hasSeries ? "No" : "Yes"}</p>
        <p><span className="font-medium text-text-graphite">Groups empty:</span> {hasGroups ? "No" : "Yes"}</p>
        <p><span className="font-medium text-text-graphite">Renderer supported:</span> {rendererSupported ? "Yes" : "No"}</p>
        <p><span className="font-medium text-text-graphite">Reason:</span> {emptyReason ?? "Adapter did not return chart options."}</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 rounded-sm border border-border-subtle p-4 lg:p-5">
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
