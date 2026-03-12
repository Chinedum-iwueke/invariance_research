function GridBackground() {
  return (
    <div
      className="h-full w-full rounded-sm"
      style={{
        backgroundImage:
          "linear-gradient(to right, rgba(229,229,229,0.45) 1px, transparent 1px), linear-gradient(to bottom, rgba(229,229,229,0.45) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
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
          strokeWidth="1.8"
          points="0,170 50,165 100,150 150,145 200,155 250,130 300,125 350,112 400,108"
        />
        <polyline
          fill="none"
          stroke="var(--chart-primary)"
          strokeWidth="2.2"
          points="0,175 50,169 100,158 150,141 200,138 250,120 300,116 350,96 400,88"
        />
      </svg>
    </div>
  );
}

export function MockEquityComparisonChart() {
  return (
    <div className="relative h-[var(--chart-height-lg)] overflow-hidden rounded-sm border bg-white p-4">
      <GridBackground />
      <svg className="absolute inset-0 h-full w-full p-4" viewBox="0 0 440 240" preserveAspectRatio="none">
        <polyline
          fill="none"
          stroke="#9ca3af"
          strokeWidth="1.6"
          points="0,190 55,176 110,168 165,159 220,149 275,137 330,126 385,119 440,112"
        />
        <polyline
          fill="none"
          stroke="var(--chart-benchmark)"
          strokeWidth="1.8"
          points="0,197 55,188 110,176 165,170 220,161 275,154 330,149 385,142 440,136"
        />
        <polyline
          fill="none"
          stroke="var(--chart-primary)"
          strokeWidth="2.3"
          points="0,203 55,190 110,179 165,164 220,152 275,138 330,129 385,113 440,97"
        />
      </svg>
    </div>
  );
}

export function MockMonteCarloFanChart() {
  const paths = [
    "0,204 60,194 120,184 180,177 240,168 300,158 360,151 440,145",
    "0,204 60,196 120,190 180,186 240,180 300,176 360,171 440,167",
    "0,204 60,200 120,199 180,198 240,199 300,199 360,203 440,208",
    "0,204 60,202 120,205 180,210 240,216 300,223 360,231 440,239",
  ];

  return (
    <div className="relative h-[var(--chart-height-lg)] overflow-hidden rounded-sm border bg-white p-4">
      <GridBackground />
      <svg className="absolute inset-0 h-full w-full p-4" viewBox="0 0 440 240" preserveAspectRatio="none">
        {paths.map((points, idx) => (
          <polyline
            key={idx}
            fill="none"
            stroke="#d1d5db"
            strokeWidth="1.3"
            points={points}
          />
        ))}
        <polyline
          fill="none"
          stroke="var(--chart-benchmark)"
          strokeWidth="2"
          points="0,204 60,195 120,188 180,182 240,176 300,170 360,166 440,162"
        />
        <polyline
          fill="none"
          stroke="var(--chart-primary)"
          strokeWidth="2.4"
          points="0,204 60,193 120,181 180,171 240,160 300,147 360,136 440,126"
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
