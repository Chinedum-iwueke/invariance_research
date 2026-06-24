import { spawn } from "node:child_process";

export type ConnectorBridgeInput = {
  venue: "bybit" | "binance"; environment: "demo" | "live"; product_type: "spot" | "perpetual"; symbols: string[];
  api_key: string; api_secret: string; action: "doctor" | "snapshot" | "reconcile" | "submit_order" | "emergency_freeze";
  deployment_id?: string; live_canary_approved?: boolean; close_positions?: boolean;
  probe_private_stream?: boolean;
  order?: { client_order_id:string; symbol:string; side:"buy"|"sell"; qty:number; order_type:"market"|"limit"; limit_price?:number; time_in_force?:string; reduce_only:boolean; metadata?:Record<string,unknown> };
};

export async function runConnectorBridge(input: ConnectorBridgeInput): Promise<Record<string, unknown>> {
  const python = process.env.INVARIANCE_PYTHON_BIN || "python3";
  const cwd = process.env.INVARIANCE_BULLETPROOF_ROOT || "/opt/bulletproof_bt";
  return new Promise((resolve, reject) => {
    const child = spawn(python, ["-m", "bt.exec.cli.connector_bridge"], {
      cwd, stdio: ["pipe", "pipe", "pipe"], env: { ...process.env, PYTHONUNBUFFERED: "1" },
    });
    let stdout = "", stderr = "";
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("connector_bridge_timeout")); }, 30_000);
    child.stdout.on("data", (chunk) => { stdout += String(chunk).slice(0, 2_000_000); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk).slice(0, 20_000); });
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("close", (code) => {
      clearTimeout(timer);
      let payload: Record<string, unknown>;
      try { payload = JSON.parse(stdout.trim().split("\n").at(-1) || "{}"); }
      catch { return reject(new Error(`connector_bridge_invalid_output:${stderr.slice(0, 500)}`)); }
      if (code !== 0 || payload.ok !== true) return reject(new Error(String(payload.error || "connector_bridge_failed")));
      resolve(payload);
    });
    child.stdin.end(JSON.stringify(input));
  });
}
