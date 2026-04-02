"use client";

import { useEffect, useMemo, useRef } from "react";
import type { EChartsOption } from "echarts";

export function EChartsHost({ option, height = 320 }: { option: EChartsOption; height?: number }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const memoizedOption = useMemo(() => option, [option]);

  useEffect(() => {
    let disposed = false;
    let chart: { dispose: () => void; setOption: (opt: EChartsOption, settings?: { notMerge?: boolean }) => void; resize: () => void } | undefined;

    async function mountChart() {
      if (!containerRef.current) return;
      const echarts = await import("echarts");
      if (disposed || !containerRef.current) return;

      chart = echarts.getInstanceByDom(containerRef.current) ?? echarts.init(containerRef.current, undefined, { renderer: "canvas" });
      chart.setOption(memoizedOption, { notMerge: true });

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

  return <div ref={containerRef} className="w-full" style={{ height }} aria-label="Diagnostic chart" />;
}
