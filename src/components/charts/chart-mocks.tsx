function GridBackground() {
  return (
    <div
      className="h-full w-full rounded-sm"
      style={{
        backgroundImage:
          "linear-gradient(to right, rgba(229,229,229,0.7) 1px, transparent 1px), linear-gradient(to bottom, rgba(229,229,229,0.7) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
      }}
    />
  );
}

export function MockLineChart() {
  return (
    <div className="relative h-[var(--chart-height-md)] overflow-hidden rounded-sm border bg-white p-4">
      <GridBackground />
      <svg className="absolute inset-0 h-full w-full p-4" viewBox="0 0 400 220" preserveAspectRatio="none">
        <polyline
          fill="none"
          stroke="var(--chart-benchmark)"
          strokeWidth="2"
          points="0,170 50,165 100,150 150,145 200,155 250,130 300,125 350,112 400,108"
        />
        <polyline
          fill="none"
          stroke="var(--chart-primary)"
          strokeWidth="2.5"
          points="0,175 50,169 100,158 150,141 200,138 250,120 300,116 350,96 400,88"
        />
      </svg>
    </div>
  );
}

export function MockHistogram() {
  return (
    <div className="relative h-[var(--chart-height-sm)] rounded-sm border bg-white p-4">
      <GridBackground />
      <div className="absolute inset-0 flex items-end gap-2 p-5">
        {[22, 36, 64, 96, 74, 44, 28].map((height, idx) => (
          <div key={idx} className="flex-1 rounded-t-[2px] bg-brand/70" style={{ height: `${height}%` }} />
        ))}
      </div>
    </div>
  );
}

export function MockHeatmap() {
  return (
    <div className="grid h-[var(--chart-height-sm)] grid-cols-8 gap-1 rounded-sm border bg-white p-3">
      {Array.from({ length: 48 }).map((_, i) => (
        <div
          key={i}
          className="rounded-[2px]"
          style={{ backgroundColor: `rgba(176,0,32,${((i % 8) + 2) / 12})` }}
        />
      ))}
    </div>
  );
}

export function MockMultiMetricPanel() {
  return (
    <div className="grid h-[var(--chart-height-md)] grid-cols-2 gap-3 rounded-sm border bg-white p-4">
      {[
        ["Sharpe", "1.42"],
        ["Sortino", "2.07"],
        ["Max DD", "-7.8%"],
        ["Hit Ratio", "58.1%"],
      ].map(([label, value]) => (
        <div key={label} className="rounded-sm border bg-surface-panel p-3">
          <p className="text-xs uppercase tracking-[0.1em] text-text-neutral">{label}</p>
          <p className="mt-2 text-2xl font-medium">{value}</p>
        </div>
      ))}
    </div>
  );
}
