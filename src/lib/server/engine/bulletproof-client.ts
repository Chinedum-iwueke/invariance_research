import path from "node:path";
import { spawn } from "node:child_process";

import type { ParsedArtifact } from "@/lib/server/ingestion";
import type { EngineAnalysisResult } from "@/lib/server/engine/engine-types";

const PYTHON_BIN = process.env.INVARIANCE_PYTHON_BIN ?? "python3";
const BRIDGE_SCRIPT_PATH = process.env.INVARIANCE_BULLETPROOF_BRIDGE_SCRIPT ?? path.join(process.cwd(), "scripts", "run_bulletproof_engine.py");
const ENGINE_TIMEOUT_MS = Number.parseInt(process.env.INVARIANCE_ENGINE_TIMEOUT_MS ?? "120000", 10);

export type BulletproofProbeResult = {
  ok: boolean;
  engine_name: string;
  engine_version?: string;
};

type BulletproofBridgeRunResponse = BulletproofProbeResult & {
  result: EngineAnalysisResult;
};

export type BulletproofBridgeConfig = {
  pythonBin: string;
  bridgeScriptPath: string;
  timeoutMs: number;
};

export function getBulletproofBridgeConfig(): BulletproofBridgeConfig {
  return {
    pythonBin: PYTHON_BIN,
    bridgeScriptPath: BRIDGE_SCRIPT_PATH,
    timeoutMs: Number.isFinite(ENGINE_TIMEOUT_MS) && ENGINE_TIMEOUT_MS > 0 ? ENGINE_TIMEOUT_MS : 120000,
  };
}

export async function probeBulletproofEngine(): Promise<BulletproofProbeResult> {
  const output = await invokeBridge(["--probe"], undefined);
  return parseBridgeOutput<BulletproofProbeResult>(output);
}

export async function runBulletproofEngine(parsedArtifact: ParsedArtifact, config?: Record<string, unknown>): Promise<BulletproofBridgeRunResponse> {
  const output = await invokeBridge([], { parsedArtifact, config: config ?? {} });
  return parseBridgeOutput<BulletproofBridgeRunResponse>(output);
}

type BridgeInvocationResult = {
  code: number;
  stdout: string;
  stderr: string;
};

async function invokeBridge(args: string[], payload?: Record<string, unknown>): Promise<BridgeInvocationResult> {
  const { pythonBin, bridgeScriptPath, timeoutMs } = getBulletproofBridgeConfig();

  return new Promise((resolve, reject) => {
    const proc = spawn(pythonBin, [bridgeScriptPath, ...args], {
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });

    let stdout = "";
    let stderr = "";

    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error(`engine_process_timeout:${timeoutMs}`));
    }, timeoutMs);

    proc.stdout.setEncoding("utf-8");
    proc.stderr.setEncoding("utf-8");

    proc.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });

    proc.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    proc.on("error", (error) => {
      clearTimeout(timer);
      reject(new Error(`engine_process_spawn_failed:${error.message}`));
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`engine_process_failed:code=${code};stderr=${stderr.trim() || "n/a"}`));
        return;
      }
      resolve({ code: code ?? 0, stdout, stderr });
    });

    if (payload) {
      proc.stdin.write(JSON.stringify(payload));
    }
    proc.stdin.end();
  });
}

function parseBridgeOutput<T>(result: BridgeInvocationResult): T {
  try {
    return JSON.parse(result.stdout) as T;
  } catch {
    throw new Error(`engine_process_invalid_json:${result.stdout.slice(0, 200)}`);
  }
}
