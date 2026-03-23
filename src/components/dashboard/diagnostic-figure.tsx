import type { FigurePayload } from "@/lib/contracts";

export function DiagnosticFigure({ figure }: { figure?: FigurePayload }) {
  if (!figure || figure.series.length === 0) {
    return <p className="rounded-sm border border-dashed border-border-subtle p-4 text-sm text-text-neutral">No chart series were emitted for this diagnostic in the persisted run payload.</p>;
  }

  const allPoints = figure.series.flatMap((series) => series.points);
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

  return (
    <div className="space-y-3 rounded-sm border border-border-subtle p-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full rounded bg-surface-panel">
        <line x1={pad} x2={pad} y1={pad} y2={height - pad} stroke="#c8cfdb" />
        <line x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} stroke="#c8cfdb" />
        {figure.series.map((series, index) => {
          const color = colorForSeries(index);
          const points = series.points.map((point) => ({ x: xFromPoint(point.x), y: yAt(point.y) }));
          const path = points.map((point, pointIndex) => `${pointIndex === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
          if (figure.type === "bar" || figure.type === "grouped_bar" || figure.type === "histogram") {
            const barWidth = Math.max(8, Math.floor((width - pad * 2) / Math.max(points.length * Math.max(figure.series.length, 1), 1)) - 2);
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
        {figure.series.map((series) => (
          <p key={series.key}><span className="font-medium text-text-graphite">{series.label}:</span> {series.points.length} points</p>
        ))}
      </div>
    </div>
  );
}
