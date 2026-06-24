import { spawnSync } from "node:child_process";
import { getPostgresPool } from "../src/lib/server/persistence/postgres";
import { getObjectStorage, getObjectStorageProvider } from "../src/lib/server/storage/object-storage";

async function main() {
  if ((process.env.DATABASE_PROVIDER ?? "sqlite") !== "postgres") {
    throw new Error("worker_healthcheck_requires_postgres");
  }

  await getPostgresPool().query("SELECT 1");

  const storage = getObjectStorage();
  const provider = getObjectStorageProvider();
  if (provider === "r2" || provider === "s3") {
    await storage.listObjects?.("");
  } else {
    await storage.objectExists("healthcheck");
  }

  if ((process.env.INVARIANCE_WORKER_KIND ?? "") === "experiment-worker") {
    const python = process.env.INVARIANCE_PYTHON_BIN || "python3";
    const probe = spawnSync(python, ["-m", "bt.cli", "experiment", "validate", "examples/experiment_plans/trend_continuation_plan_reference.json"], {
      cwd: process.env.INVARIANCE_BULLETPROOF_ROOT || "/opt/bulletproof_bt",
      encoding: "utf8",
      timeout: 10_000,
    });
    if (probe.status !== 0) {
      throw new Error(probe.stderr || probe.stdout || "bt_experiment_contract_unavailable");
    }
  }
  if ((process.env.INVARIANCE_WORKER_KIND ?? "") === "execution-worker") {
    if (!process.env.EXCHANGE_CREDENTIAL_ENCRYPTION_KEY) throw new Error("exchange_credential_encryption_key_missing");
    const python = process.env.INVARIANCE_PYTHON_BIN || "python3";
    const probe = spawnSync(python, ["-c", "import bt.exec.cli.connector_bridge"], {
      cwd: process.env.INVARIANCE_BULLETPROOF_ROOT || "/opt/bulletproof_bt", encoding: "utf8", timeout: 10_000,
    });
    if (probe.status !== 0) throw new Error(probe.stderr || "connector_bridge_unavailable");
  }
}

main()
  .then(() => {
    const workerKind = process.env.INVARIANCE_WORKER_KIND ?? "worker";
    console.log(`${workerKind} healthcheck ok`);
    process.exit(0);
  })
  .catch((error) => {
    const workerKind = process.env.INVARIANCE_WORKER_KIND ?? "worker";
    console.error(error instanceof Error ? error.message : `${workerKind} healthcheck failed`);
    process.exit(1);
  });
