import { NextResponse } from "next/server";
import { BENCHMARK_IDS } from "@/lib/benchmarks/benchmark-ids";
import { getBenchmarkDatasetPath, getBenchmarkManifest, getBenchmarkManifestPath } from "@/lib/benchmarks/benchmark-library";
import { BenchmarkManifestError } from "@/lib/benchmarks/benchmark-manifest";

export async function GET() {
  try {
    const manifest = await getBenchmarkManifest();
    const benchmarks = await Promise.all(
      BENCHMARK_IDS.map(async (benchmarkId) => {
        const entry = manifest.benchmarks[benchmarkId];
        const datasetPath = await getBenchmarkDatasetPath(benchmarkId);
        return {
          id: entry.id,
          file: entry.file,
          datasetPath,
          frequency: entry.frequency,
          source: entry.source,
        };
      }),
    );

    return NextResponse.json(
      {
        status: "ok",
        manifestPath: getBenchmarkManifestPath(),
        revision: manifest.revision,
        benchmarkCount: benchmarks.length,
        benchmarks,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof BenchmarkManifestError) {
      return NextResponse.json(
        {
          status: "error",
          error: "benchmark_manifest_invalid",
          message: error.message,
          details: error.details,
          manifestPath: getBenchmarkManifestPath(),
        },
        { status: 500 },
      );
    }

    const message = error instanceof Error ? error.message : "Unexpected error while loading benchmark manifest.";
    return NextResponse.json(
      {
        status: "error",
        error: "benchmark_manifest_unavailable",
        message,
        manifestPath: getBenchmarkManifestPath(),
      },
      { status: 500 },
    );
  }
}
