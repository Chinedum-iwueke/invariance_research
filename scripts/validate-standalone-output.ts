import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");
const errors: string[] = [];

function exists(relativePath: string) {
  return fs.existsSync(path.join(standalone, relativePath));
}

function directorySize(directory: string): number {
  return fs.readdirSync(directory, { withFileTypes: true }).reduce((total, entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return total + directorySize(target);
    return entry.isFile() ? total + fs.statSync(target).size : total;
  }, 0);
}

if (!exists("server.js")) errors.push("standalone server.js is missing");
if (!exists(".next/server")) errors.push("standalone Next.js server output is missing");

for (const forbidden of [
  ".data",
  ".debug-analysis",
  "tests",
  "src/__tests__",
  "scripts/run_bulletproof_engine.py",
  "scripts/run-analysis-worker.ts",
  "scripts/run-export-worker.ts",
  "scripts/run-experiment-worker.ts",
  "scripts/run-execution-worker.ts",
  "Dockerfile.worker",
]) {
  if (exists(forbidden)) errors.push(`forbidden web runtime path present: ${forbidden}`);
}

if (fs.existsSync(standalone)) {
  const sizeBytes = directorySize(standalone);
  const maxBytes = Number.parseInt(process.env.STANDALONE_MAX_BYTES ?? String(300 * 1024 * 1024), 10);
  if (sizeBytes > maxBytes) {
    errors.push(`standalone output is ${sizeBytes} bytes; limit is ${maxBytes} bytes`);
  }
  console.log(`Standalone output size: ${(sizeBytes / 1024 / 1024).toFixed(1)} MiB`);
}

if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exitCode = 1;
} else {
  console.log("Standalone output contract is valid.");
}
