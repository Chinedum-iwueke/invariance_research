import { NextResponse } from "next/server";
import { getBenchmarkLibraryHealth } from "@/lib/benchmarks/benchmark-library";

export async function GET() {
  const health = await getBenchmarkLibraryHealth();
  const statusCode = health.status === "healthy" ? 200 : health.status === "degraded" ? 200 : 503;

  return NextResponse.json(
    {
      status: health.status,
      manifestPath: health.manifestPath,
      revision: health.revision,
      benchmarkEntryCount: health.benchmarkEntryCount,
      benchmarkIds: health.benchmarkIds,
      benchmarkResults: health.benchmarkResults,
      errors: health.errors,
    },
    { status: statusCode },
  );
}
