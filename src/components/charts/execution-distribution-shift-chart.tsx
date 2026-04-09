export function ExecutionDistributionShiftChart() {
  const xTicks = [-6, -3, 0, 3, 6, 9].map((value, idx) => ({ value, x: 72 + idx * 66 }));
  const yTicks = [0, 0.05, 0.1, 0.15, 0.2].map((value, idx) => ({ value, y: 216 - idx * 39 }));

  return (
    <div className="relative h-[var(--chart-height-md)] overflow-hidden rounded-sm border border-border-subtle bg-surface-white p-4">
      <svg className="h-full w-full" viewBox="0 0 520 280" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Expected return distribution comparison for naive and execution-aware assumptions">
        <rect x="0" y="0" width="520" height="280" fill="transparent" />

        {[72, 138, 204, 270, 336, 402, 468].map((x) => (
          <line key={`v-${x}`} x1={x} y1={28} x2={x} y2={216} stroke="rgba(113,113,122,0.16)" strokeWidth="1" />
        ))}
        {[60, 99, 138, 177, 216].map((y) => (
          <line key={`h-${y}`} x1={72} y1={y} x2={468} y2={y} stroke="rgba(113,113,122,0.16)" strokeWidth="1" />
        ))}

        <line x1={72} y1={216} x2={468} y2={216} stroke="rgba(39,39,42,0.75)" strokeWidth="1.2" />
        <line x1={72} y1={28} x2={72} y2={216} stroke="rgba(39,39,42,0.75)" strokeWidth="1.2" />

        <path
          d="M72 214 C110 205, 138 176, 174 126 C196 96, 220 78, 246 70 C278 60, 300 70, 324 98 C346 126, 366 154, 392 178 C415 198, 438 208, 468 214 L468 216 L72 216 Z"
          fill="rgba(156,163,175,0.26)"
        />
        <path
          d="M72 214 C106 210, 134 196, 164 170 C190 147, 212 126, 240 114 C270 101, 292 108, 318 126 C340 142, 360 162, 386 184 C409 201, 434 210, 468 214 L468 216 L72 216 Z"
          fill="rgba(176,0,32,0.18)"
        />

        <path
          d="M72 214 C110 205, 138 176, 174 126 C196 96, 220 78, 246 70 C278 60, 300 70, 324 98 C346 126, 366 154, 392 178 C415 198, 438 208, 468 214"
          fill="none"
          stroke="#6b7280"
          strokeWidth="2"
        />
        <path
          d="M72 214 C106 210, 134 196, 164 170 C190 147, 212 126, 240 114 C270 101, 292 108, 318 126 C340 142, 360 162, 386 184 C409 201, 434 210, 468 214"
          fill="none"
          stroke="#b00020"
          strokeWidth="2.4"
        />

        {xTicks.map((tick) => (
          <text key={`x-${tick.value}`} x={tick.x} y={238} textAnchor="middle" className="fill-text-neutral text-[11px]">
            {tick.value}
          </text>
        ))}

        {yTicks.map((tick) => (
          <text key={`y-${tick.value}`} x={58} y={tick.y + 4} textAnchor="end" className="fill-text-neutral text-[11px]">
            {tick.value.toFixed(2)}
          </text>
        ))}

        <text x={270} y={260} textAnchor="middle" className="fill-text-neutral text-[12px]">
          Net Return / Outcome
        </text>
        <text x={16} y={122} transform="rotate(-90 16 122)" textAnchor="middle" className="fill-text-neutral text-[12px]">
          Frequency / Probability Density
        </text>
      </svg>
    </div>
  );
}
