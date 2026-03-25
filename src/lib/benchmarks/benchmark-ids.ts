export const BENCHMARK_IDS = ["BTC", "SPY", "XAUUSD", "DXY"] as const;

export type BenchmarkId = (typeof BENCHMARK_IDS)[number];

export const BENCHMARK_OPTIONS = ["Auto", "None", ...BENCHMARK_IDS] as const;

export type BenchmarkOption = (typeof BENCHMARK_OPTIONS)[number];

export function isBenchmarkId(value: string): value is BenchmarkId {
  return (BENCHMARK_IDS as readonly string[]).includes(value);
}
