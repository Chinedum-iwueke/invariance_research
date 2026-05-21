"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { EChartsOption } from "echarts";

export function EChartsHost({ option, height = 480 }: { option: EChartsOption; height?: number }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const memoizedOption = useMemo(() => option, [option]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let disposed = false;
    let chart: { dispose: () => void; setOption: (opt: EChartsOption, settings?: { notMerge?: boolean }) => void; resize: () => void } | undefined;
    setReady(false);

    async function mountChart() {
      if (!containerRef.current) return;
      const echarts = await import("echarts");
      if (disposed || !containerRef.current) return;

      chart = echarts.getInstanceByDom(containerRef.current) ?? echarts.init(containerRef.current, undefined, { renderer: "canvas" });
      chart.setOption(memoizedOption, { notMerge: true });
      setReady(true);

      const observer = new ResizeObserver(() => chart?.resize());
      observer.observe(containerRef.current);

      return () => observer.disconnect();
    }

    const cleanupPromise = mountChart();

    return () => {
      disposed = true;
      cleanupPromise?.then((cleanup) => cleanup?.());
      chart?.dispose();
    };
  }, [memoizedOption]);

  return (
    <div className="relative w-full" style={{ height }}>
      <div ref={containerRef} className="h-full w-full" aria-label="Diagnostic chart" />
      {!ready ? (
        <div className="absolute inset-0 grid place-items-center rounded-sm border border-dashed border-border-subtle bg-surface-panel text-xs font-medium uppercase tracking-[0.12em] text-text-neutral">
          Preparing chart
        </div>
      ) : null}
    </div>
  );
}
