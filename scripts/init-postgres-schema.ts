import { ensurePostgresSchema } from "../src/lib/server/persistence/postgres";

async function main() {
  await ensurePostgresSchema();
  console.log("Postgres schema is initialized.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
