import { ensurePostgresSchema } from "../src/lib/server/persistence/postgres";

async function main() {
  process.env.POSTGRES_SCHEMA_AUTO_INIT = "true";
  await ensurePostgresSchema();
  console.log("Postgres schema is initialized.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
