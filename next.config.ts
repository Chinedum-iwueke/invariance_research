import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingExcludes: {
    "/*": [
      "./.data/**/*",
      "./.debug-analysis/**/*",
      "./scripts/run_bulletproof_engine.py",
      "./scripts/run-analysis-worker.ts",
      "./scripts/run-export-worker.ts",
      "./scripts/run-experiment-worker.ts",
      "./scripts/run-execution-worker.ts",
      "./Dockerfile.worker",
    ],
  },
  poweredByHeader: false,
};

export default nextConfig;
