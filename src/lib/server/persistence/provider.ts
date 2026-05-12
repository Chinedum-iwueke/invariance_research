export type DatabaseProvider = "sqlite" | "postgres";

export function getDatabaseProvider(): DatabaseProvider {
  const provider = process.env.DATABASE_PROVIDER ?? "sqlite";
  if (provider !== "sqlite" && provider !== "postgres") {
    throw new Error(`Unsupported DATABASE_PROVIDER "${provider}". Expected sqlite or postgres.`);
  }
  return provider;
}
