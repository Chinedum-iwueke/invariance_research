import { spawn } from "node:child_process";
import { cleanupExpiredExports, cleanupShareAccessEvents, cleanupStaleFailedJobs, runMaintenanceSweep } from "@/lib/server/maintenance/retention-service";

function runCommand(command: string, args: string[]) {
  return new Promise<{ ok: boolean; command: string; exit_code: number | null; output: string }>((resolve) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      output += String(chunk);
    });
    child.on("close", (code) => {
      resolve({ ok: code === 0, command: `${command} ${args.join(" ")}`, exit_code: code, output: output.slice(-8000) });
    });
    child.on("error", (error) => {
      resolve({ ok: false, command: `${command} ${args.join(" ")}`, exit_code: null, output: error.message });
    });
  });
}

export function runAdminMaintenanceAction(action: "sweep" | "expired_exports" | "stale_failed_jobs" | "share_access_events" | "benchmark_library_refresh") {
  if (action === "sweep") return runMaintenanceSweep();
  if (action === "expired_exports") return cleanupExpiredExports();
  if (action === "share_access_events") return cleanupShareAccessEvents();
  if (action === "benchmark_library_refresh") return runCommand("npm", ["run", "benchmarks:weekly"]);
  return cleanupStaleFailedJobs();
}
