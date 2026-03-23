import type { FigurePayload } from "@/lib/contracts";

export function DiagnosticFigure({ figure }: { figure?: FigurePayload }) {
  if (!figure || figure.series.length === 0) {
    return <p className="rounded-sm border border-dashed border-border-subtle p-4 text-sm text-text-neutral">No chart series were emitted for this diagnostic in the persisted run payload.</p>;
  }

  return (
    <div className="rounded-sm border border-border-subtle">
      <table className="w-full text-left text-sm">
        <thead className="bg-surface-panel text-xs uppercase tracking-wide text-text-neutral">
          <tr>
            <th className="p-2">Series</th>
            <th className="p-2">Points</th>
            <th className="p-2">Range</th>
          </tr>
        </thead>
        <tbody>
          {figure.series.map((series) => {
            const first = series.points[0];
            const last = series.points[series.points.length - 1];
            return (
              <tr key={series.key} className="border-t">
                <td className="p-2 font-medium text-text-institutional">{series.label}</td>
                <td className="p-2 text-text-neutral">{series.points.length}</td>
                <td className="p-2 text-text-neutral">{first?.y.toFixed(2)} → {last?.y.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
