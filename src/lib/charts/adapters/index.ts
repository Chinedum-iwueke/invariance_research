import type { FigurePayload } from "@/lib/contracts";
import type { AdaptedChart, FigureTypeAdapter } from "./types";
import { normalizeFigureSeries } from "./utils";
import { lineAdapter } from "./line-adapter";
import { histogramAdapter } from "./histogram-adapter";
import { groupedBarAdapter } from "./grouped-bar-adapter";
import { fanChartAdapter } from "./fan-chart-adapter";
import { barAdapter } from "./bar-adapter";
import { scatterAdapter } from "./scatter-adapter";
import { heatmapAdapter } from "./heatmap-adapter";
import { benchmarkRelativeAdapter } from "./benchmark-relative-adapter";

const ADAPTERS: Partial<Record<FigurePayload["type"], FigureTypeAdapter>> = {
  line: lineAdapter,
  histogram: histogramAdapter,
  grouped_bar: groupedBarAdapter,
  fan: fanChartAdapter,
  fan_chart: fanChartAdapter,
  bar: barAdapter,
  scatter: scatterAdapter,
  heatmap: heatmapAdapter,
};

function hasRenderableFanBands(figure: FigurePayload): boolean {
  const raw = figure as FigurePayload & Record<string, unknown>;
  const x = Array.isArray(raw.x) ? raw.x : undefined;
  const bands = raw.bands;
  if (!x?.length || !bands || typeof bands !== "object" || Array.isArray(bands)) return false;
  return ["p5", "p25", "p50", "p75", "p95"].some((key) => Array.isArray((bands as Record<string, unknown>)[key]) && ((bands as Record<string, unknown>)[key] as unknown[]).length > 0);
}

export function adaptFigureToECharts(figure?: FigurePayload): { adapted?: AdaptedChart; emptyReason?: string; rendererSupported: boolean } {
  if (!figure) return { rendererSupported: false, emptyReason: "renderer received undefined figure" };

  const adapter = ADAPTERS[figure.type];
  if (!adapter) {
    return {
      rendererSupported: false,
      emptyReason: `renderer does not support figure type ${figure.type}`,
    };
  }

  const series = normalizeFigureSeries(figure);
  const fanChartWithBands = (figure.type === "fan" || figure.type === "fan_chart") && hasRenderableFanBands(figure);
  const groupedBarWithGroups = figure.type === "grouped_bar" && Array.isArray(figure.groups) && figure.groups.length > 0;
  if (!series.length && !fanChartWithBands && !groupedBarWithGroups) {
    return {
      rendererSupported: true,
      emptyReason: `renderer found no renderable series for ${figure.type}`,
    };
  }

  const benchmarkRelative = benchmarkRelativeAdapter({ figure, series });
  if (benchmarkRelative) {
    return { rendererSupported: true, adapted: benchmarkRelative };
  }

  const adapted = adapter({ figure, series });
  if (!adapted) {
    return {
      rendererSupported: true,
      emptyReason: `adapter failed to build options for ${figure.type}`,
    };
  }

  return { rendererSupported: true, adapted };
}

export function isFigureAdaptable(figure?: FigurePayload): boolean {
  return Boolean(adaptFigureToECharts(figure).adapted);
}

export const supportedFigureTypes = Object.freeze(Object.keys(ADAPTERS));
