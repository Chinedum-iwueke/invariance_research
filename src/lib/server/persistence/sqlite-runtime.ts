import { getDb } from "@/lib/server/persistence/database";

export function getSqliteRuntimeDb() {
  return getDb();
}
