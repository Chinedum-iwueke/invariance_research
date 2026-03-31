import type { FigurePayload, FigureSeries } from "@/lib/contracts";
import { adaptFigureToECharts } from "@/lib/charts/adapters";

export function getRenderableSeries(figure?: FigurePayload): { series: FigureSeries[]; rendererSupported: boolean; emptyReason?: string } {
  if (!figure) return { series: [], rendererSupported: false, emptyReason: "renderer received undefined figure" };

  const { adapted, rendererSupported, emptyReason } = adaptFigureToECharts(figure);
  if (!rendererSupported || !adapted) {
    return { series: [], rendererSupported, emptyReason };
  }

  return {
    series: adapted.summary,
    rendererSupported: true,
  };
}

export function isFigureRenderable(figure?: FigurePayload): boolean {
  return Boolean(adaptFigureToECharts(figure).adapted);
}
