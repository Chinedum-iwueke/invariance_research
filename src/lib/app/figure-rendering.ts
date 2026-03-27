import type { FigurePayload, FigureSeries } from "@/lib/contracts";
import { adaptFigureToECharts } from "@/lib/charts/adapters";
import { normalizeFigureSeries } from "@/lib/charts/adapters/utils";

export function getRenderableSeries(figure?: FigurePayload): { series: FigureSeries[]; rendererSupported: boolean; emptyReason?: string } {
  if (!figure) return { series: [], rendererSupported: false, emptyReason: "renderer received undefined figure" };

  const { rendererSupported, emptyReason } = adaptFigureToECharts(figure);
  if (!rendererSupported) {
    return { series: [], rendererSupported: false, emptyReason };
  }

  const series = normalizeFigureSeries(figure);
  if (!series.length) {
    return { series: [], rendererSupported: true, emptyReason: emptyReason ?? `renderer found no renderable series for ${figure.type}` };
  }

  return { series, rendererSupported: true };
}

export function isFigureRenderable(figure?: FigurePayload): boolean {
  return Boolean(adaptFigureToECharts(figure).adapted);
}
