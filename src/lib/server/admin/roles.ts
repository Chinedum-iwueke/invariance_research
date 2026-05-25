import { getDatabaseProvider } from "@/lib/server/persistence/provider";
import { getPostgresPool } from "@/lib/server/persistence/postgres";
import { getSqliteRuntimeDb } from "@/lib/server/persistence/sqlite-runtime";
import { writeAdminAuditLog } from "@/lib/server/admin/audit-log";

export type UserRole = "owner" | "admin" | "analyst" | "user";
const ADMIN_ROLES = new Set<UserRole>(["owner", "admin"]);
let userRolesSchemaReady: Promise<void> | undefined;

function parseAllowlist(value?: string): Set<string> {
  return new Set((value ?? "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean));
}

export function isBootstrapAdminIdentity(input: { user_id: string; email: string }) {
  return parseAllowlist(process.env.ADMIN_EMAILS).has(input.email.toLowerCase())
    || parseAllowlist(process.env.ADMIN_USER_IDS).has(input.user_id.toLowerCase());
}

async function ensureUserRolesSchema() {
  userRolesSchemaReady ??= (async () => {
    if (getDatabaseProvider() === "postgres") {
      await getPostgresPool().query(`
        CREATE TABLE IF NOT EXISTS user_roles (
          user_id TEXT NOT NULL REFERENCES users(user_id),
          role TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL,
          created_by TEXT,
          PRIMARY KEY (user_id, role)
        )
      `);
      await getPostgresPool().query("CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role)");
      return;
    }

    getSqliteRuntimeDb().exec(`
      CREATE TABLE IF NOT EXISTS user_roles (
        user_id TEXT NOT NULL REFERENCES users(user_id),
        role TEXT NOT NULL,
        created_at TEXT NOT NULL,
        created_by TEXT,
        PRIMARY KEY (user_id, role)
      );
      CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);
    `);
  })();
  await userRolesSchemaReady;
}

export async function assignUserRole(input: { userId: string; role: UserRole; createdBy?: string | null; audit?: boolean }) {
  await ensureUserRolesSchema();
  const now = new Date().toISOString();
  if (getDatabaseProvider() === "postgres") {
    await getPostgresPool().query(
      `INSERT INTO user_roles (user_id, role, created_at, created_by)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT(user_id, role) DO NOTHING`,
      [input.userId, input.role, now, input.createdBy ?? null],
    );
  } else {
    getSqliteRuntimeDb()
      .prepare("INSERT OR IGNORE INTO user_roles (user_id, role, created_at, created_by) VALUES (?, ?, ?, ?)")
      .run(input.userId, input.role, now, input.createdBy ?? null);
  }

  if (input.audit) {
    await writeAdminAuditLog({
      actor: input.createdBy ? { user_id: input.createdBy } : undefined,
      action: "role.assign",
      resourceType: "user",
      resourceId: input.userId,
      metadata: { role: input.role },
    });
  }
}

export async function listUserRoles(userId: string): Promise<UserRole[]> {
  await ensureUserRolesSchema();
  if (getDatabaseProvider() === "postgres") {
    const result = await getPostgresPool().query<{ role: UserRole }>("SELECT role FROM user_roles WHERE user_id = $1", [userId]);
    return result.rows.map((row) => row.role);
  }
  const rows = getSqliteRuntimeDb().prepare("SELECT role FROM user_roles WHERE user_id = ?").all(userId) as Array<{ role: UserRole }>;
  return rows.map((row) => row.role);
}

export async function ensureBootstrapAdminRole(input: { user_id: string; email: string }) {
  if (!isBootstrapAdminIdentity(input)) return;
  const role: UserRole = parseAllowlist(process.env.ADMIN_EMAILS).has(input.email.toLowerCase()) ? "owner" : "admin";
  await assignUserRole({ userId: input.user_id, role, createdBy: "bootstrap:ADMIN_EMAILS", audit: true });
}

export async function userHasAdminRole(input: { user_id: string; email: string }) {
  await ensureBootstrapAdminRole(input);
  const roles = await listUserRoles(input.user_id);
  return roles.some((role) => ADMIN_ROLES.has(role));
}
