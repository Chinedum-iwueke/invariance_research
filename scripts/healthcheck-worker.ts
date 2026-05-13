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
}

main()
  .then(() => {
    console.log("analysis-worker healthcheck ok");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "analysis-worker healthcheck failed");
    process.exit(1);
  });
