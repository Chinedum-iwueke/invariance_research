import type { FigurePayload } from "@/lib/contracts";
import { getRenderableSeries } from "@/lib/app/figure-rendering";

function parsePercentileToken(value: string): number | undefined {
  const match = value.toLowerCase().match(/(?:^|[^0-9])(p?\s?(\d{1,2}|100))(?:[^0-9]|$)/);
  if (!match?.[1]) return undefined;
  const normalized = Number(match[1].replace("p", "").trim());
  return Number.isFinite(normalized) && normalized >= 0 && normalized <= 100 ? normalized : undefined;
}

function buildLinePath(points: Array<{ x: number; y: number }>) {
  return points.map((point, pointIndex) => `${pointIndex === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

export function DiagnosticFigure({ figure, emptyMessage }: { figure?: FigurePayload; emptyMessage?: string }) {
  const { series: renderSeries, rendererSupported, emptyReason } = getRenderableSeries(figure);

  if (!figure || renderSeries.length === 0) {
    console.log("[analysis-page-debug]", {
      scope: "analysis-page-debug",
      component: "DiagnosticFigure",
      branch: "empty_state_branch",
      renderer_supported: Boolean(figure) ? rendererSupported : false,
      visible_render_path: false,
      fallback_to_placeholder: true,
      figure_type: figure?.type ?? null,
      empty_state_reason: emptyReason ?? (!figure ? "renderer received undefined figure" : "renderer received figure with zero series"),
    });
    return <p className="rounded-sm border border-dashed border-border-subtle bg-surface-panel p-4 text-sm text-text-neutral">{emptyMessage ?? "No chart series were emitted for this diagnostic in the persisted run payload."}</p>;
  }

  const allPoints = renderSeries.flatMap((series) => series.points);
  const hasAnyPoints = allPoints.length > 0;
  const hasNumericY = allPoints.some((point) => Number.isFinite(point.y));
  const visibleRenderPath = hasAnyPoints && hasNumericY;
  console.log("[analysis-page-debug]", {
    scope: "analysis-page-debug",
    component: "DiagnosticFigure",
    branch: visibleRenderPath ? "render_chart_branch" : "empty_like_chart_branch",
    figure_id: figure.figure_id,
    figure_type: figure.type,
    renderer_supported: rendererSupported,
    visible_render_path: visibleRenderPath,
    fallback_to_placeholder: false,
    series_count: renderSeries.length,
    point_count: allPoints.length,
    empty_state_reason: visibleRenderPath
      ? undefined
      : (hasAnyPoints ? "renderer rejected data: no numeric y-values detected" : "renderer rejected data: no points in any series"),
  });
  const numericX = allPoints.map((point) => (typeof point.x === "number" ? point.x : undefined)).filter((value): value is number => typeof value === "number");
  const yValues = allPoints.map((point) => point.y).filter((value) => Number.isFinite(value));
  const minX = numericX.length ? Math.min(...numericX) : 0;
  const maxX = numericX.length ? Math.max(...numericX) : Math.max(1, allPoints.length - 1);
  const minY = yValues.length ? Math.min(...yValues) : 0;
  const maxY = yValues.length ? Math.max(...yValues) : 1;
  const width = 740;
  const height = 260;
  const pad = 22;
  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);
  const xAt = (value: number) => pad + ((value - minX) / spanX) * (width - pad * 2);
  const yAt = (value: number) => height - pad - ((value - minY) / spanY) * (height - pad * 2);
  const colorForSeries = (index: number) => ["#356ae6", "#009966", "#9747ff", "#e45c34", "#0087a3"][index % 5];
  const categoricalIndex = new Map<string, number>();
  allPoints.forEach((point) => {
    if (typeof point.x === "string" && !categoricalIndex.has(point.x)) categoricalIndex.set(point.x, categoricalIndex.size);
  });
  const xFromPoint = (x: string | number) => typeof x === "number" ? xAt(x) : xAt(categoricalIndex.get(x) ?? 0);

  const fanSeries = (figure.type === "fan" || figure.type === "fan_chart")
    ? renderSeries
        .map((series) => ({ series, percentile: parsePercentileToken(`${series.label} ${series.key}`) }))
        .filter((item) => item.percentile !== undefined)
        .sort((a, b) => (a.percentile as number) - (b.percentile as number))
    : [];
  const percentileMap = new Map<number, FigurePayload["series"][number]>(fanSeries.map((item) => [item.percentile as number, item.series]));
  const medianSeries = percentileMap.get(50);
  const fanBandPairs = [5, 10, 25]
    .map((lower) => {
      const upper = 100 - lower;
      const lowSeries = percentileMap.get(lower);
      const highSeries = percentileMap.get(upper);
      if (!lowSeries || !highSeries) return undefined;
      const lowPoints = lowSeries.points.map((point) => ({ x: xFromPoint(point.x), y: yAt(point.y) }));
      const highPoints = highSeries.points.map((point) => ({ x: xFromPoint(point.x), y: yAt(point.y) }));
      if (lowPoints.length === 0 || highPoints.length === 0 || lowPoints.length !== highPoints.length) return undefined;
      return { key: `${lower}-${upper}`, lower, upper, lowPoints, highPoints };
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value))
    .sort((a, b) => a.lower - b.lower);

  return (
    <div className="space-y-3 rounded-sm border border-border-subtle p-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full rounded bg-surface-panel">
        <line x1={pad} x2={pad} y1={pad} y2={height - pad} stroke="#c8cfdb" />
        <line x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} stroke="#c8cfdb" />
        {(figure.type === "fan" || figure.type === "fan_chart") && fanBandPairs.length > 0 ? (
          <g>
            {fanBandPairs.map((band, idx) => {
              const fillPalette = ["rgba(11,47,122,0.09)", "rgba(11,47,122,0.14)", "rgba(11,47,122,0.2)"];
              const strokePalette = ["rgba(11,47,122,0.35)", "rgba(11,47,122,0.45)", "rgba(11,47,122,0.55)"];
              const polygon = `${buildLinePath(band.lowPoints)} L ${band.highPoints[band.highPoints.length - 1]?.x ?? 0} ${band.highPoints[band.highPoints.length - 1]?.y ?? 0} ${band.highPoints
                .slice(0, -1)
                .reverse()
                .map((point) => `L ${point.x} ${point.y}`)
                .join(" ")} Z`;
              return (
                <g key={band.key}>
                  <path d={polygon} fill={fillPalette[Math.min(idx, fillPalette.length - 1)]} />
                  <path d={buildLinePath(band.lowPoints)} fill="none" stroke={strokePalette[Math.min(idx, strokePalette.length - 1)]} strokeWidth={1} />
                  <path d={buildLinePath(band.highPoints)} fill="none" stroke={strokePalette[Math.min(idx, strokePalette.length - 1)]} strokeWidth={1} />
                </g>
              );
            })}
            {medianSeries ? (
              <path
                d={buildLinePath(medianSeries.points.map((point) => ({ x: xFromPoint(point.x), y: yAt(point.y) })))}
                fill="none"
                stroke="#0b2f7a"
                strokeWidth={2.2}
              />
            ) : null}
          </g>
        ) : null}
        {renderSeries.map((series, index) => {
          const color = colorForSeries(index);
          const points = series.points.map((point) => ({ x: xFromPoint(point.x), y: yAt(point.y) }));
          const path = buildLinePath(points);
          if (figure.type === "bar" || figure.type === "grouped_bar" || figure.type === "histogram") {
            const barWidth = Math.max(8, Math.floor((width - pad * 2) / Math.max(points.length * Math.max(renderSeries.length, 1), 1)) - 2);
            return (
              <g key={series.key}>
                {points.map((point, pointIndex) => {
                  const offset = figure.type === "grouped_bar" ? index * (barWidth + 2) : 0;
                  return <rect key={`${series.key}-${pointIndex}`} x={point.x - barWidth / 2 + offset} y={point.y} width={barWidth} height={height - pad - point.y} fill={color} opacity={0.8} />;
                })}
              </g>
            );
          }
          if (figure.type === "heatmap") {
            return (
              <g key={series.key}>
                {points.map((point, pointIndex) => {
                  const value = series.points[pointIndex]?.y ?? 0;
                  const intensity = spanY === 0 ? 0 : (value - minY) / spanY;
                  return <rect key={`${series.key}-${pointIndex}`} x={point.x - 8} y={point.y - 8} width={16} height={16} fill={`rgba(53,106,230,${0.15 + intensity * 0.85})`} />;
                })}
              </g>
            );
          }
          if ((figure.type === "fan" || figure.type === "fan_chart") && fanBandPairs.length > 0 && parsePercentileToken(`${series.label} ${series.key}`) !== undefined) return null;
          return (
            <g key={series.key}>
              {(figure.type === "area" || figure.type === "fan" || figure.type === "fan_chart") ? <path d={`${path} L ${points[points.length - 1]?.x ?? 0} ${height - pad} L ${points[0]?.x ?? 0} ${height - pad} Z`} fill={color} opacity={figure.type === "fan" || figure.type === "fan_chart" ? 0.12 : 0.2} /> : null}
              <path d={path} fill="none" stroke={color} strokeWidth={2} opacity={figure.type === "fan" || figure.type === "fan_chart" ? 0.7 : 1} />
              {(figure.type === "scatter") ? points.map((point, pointIndex) => <circle key={`${series.key}-${pointIndex}`} cx={point.x} cy={point.y} r={3} fill={color} />) : null}
            </g>
          );
        })}
      </svg>
      <div className="grid gap-2 text-xs text-text-neutral md:grid-cols-2">
        {renderSeries.map((series) => (
          <p key={series.key}><span className="font-medium text-text-graphite">{series.label}:</span> {series.points.length} points</p>
        ))}
      </div>
    </div>
  );
}
