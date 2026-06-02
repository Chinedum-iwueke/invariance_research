import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/server/persistence/database";
import { getDatabaseProvider } from "@/lib/server/persistence/provider";
import { getPostgresPool } from "@/lib/server/persistence/postgres";

export type WaitlistStatus = "new" | "contacted" | "invited" | "archived";

export type WaitlistEntry = {
  waitlist_entry_id: string;
  email: string;
  name: string | null;
  source_page: string;
  role_or_team: string | null;
  status: WaitlistStatus;
  note: string | null;
  created_at: string;
  updated_at: string;
};

const VALID_STATUSES: WaitlistStatus[] = ["new", "contacted", "invited", "archived"];

export function isValidWaitlistStatus(value: string): value is WaitlistStatus {
  return VALID_STATUSES.includes(value as WaitlistStatus);
}

export function createWaitlistEntry(input: { email: string; name?: string; sourcePage: string; roleOrTeam?: string }) {
  const now = new Date().toISOString();
  const normalizedEmail = input.email.trim().toLowerCase();

  if (getDatabaseProvider() === "postgres") {
    return getPostgresPool()
      .query<{ waitlist_entry_id?: string }>("SELECT waitlist_entry_id FROM waitlist_entries WHERE normalized_email = $1 AND source_page = $2", [normalizedEmail, input.sourcePage])
      .then(async (result) => {
        const existing = result.rows[0];
        if (existing?.waitlist_entry_id) {
          return { duplicate: true as const, waitlistEntryId: existing.waitlist_entry_id };
        }

        const waitlistEntryId = randomUUID();
        await getPostgresPool().query(
          `INSERT INTO waitlist_entries (
            waitlist_entry_id, email, normalized_email, name, source_page, role_or_team, status, note, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, 'new', NULL, $7, $8)`,
          [
            waitlistEntryId,
            input.email.trim(),
            normalizedEmail,
            input.name?.trim() || null,
            input.sourcePage,
            input.roleOrTeam?.trim() || null,
            now,
            now,
          ],
        );

        return { duplicate: false as const, waitlistEntryId };
      });
  }

  const existing = getDb()
    .prepare("SELECT waitlist_entry_id FROM waitlist_entries WHERE normalized_email = ? AND source_page = ?")
    .get(normalizedEmail, input.sourcePage) as { waitlist_entry_id?: string } | undefined;

  if (existing?.waitlist_entry_id) {
    return { duplicate: true as const, waitlistEntryId: existing.waitlist_entry_id };
  }

  const waitlistEntryId = randomUUID();
  getDb()
    .prepare(
      `INSERT INTO waitlist_entries (
        waitlist_entry_id, email, normalized_email, name, source_page, role_or_team, status, note, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'new', NULL, ?, ?)`,
    )
    .run(
      waitlistEntryId,
      input.email.trim(),
      normalizedEmail,
      input.name?.trim() || null,
      input.sourcePage,
      input.roleOrTeam?.trim() || null,
      now,
      now,
    );

  return { duplicate: false as const, waitlistEntryId };
}

function mapWaitlistRow(row: Record<string, unknown>): WaitlistEntry {
  return {
    waitlist_entry_id: String(row.waitlist_entry_id),
    email: String(row.email),
    name: row.name ? String(row.name) : null,
    source_page: String(row.source_page),
    role_or_team: row.role_or_team ? String(row.role_or_team) : null,
    status: row.status as WaitlistStatus,
    note: row.note ? String(row.note) : null,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

export function listWaitlistEntries(status?: WaitlistStatus): WaitlistEntry[] | Promise<WaitlistEntry[]> {
  if (getDatabaseProvider() === "postgres") {
    return (status
      ? getPostgresPool().query<WaitlistEntry & { created_at: Date | string; updated_at: Date | string }>(
          `SELECT waitlist_entry_id, email, name, source_page, role_or_team, status, note, created_at, updated_at
           FROM waitlist_entries
           WHERE status = $1
           ORDER BY created_at DESC`,
          [status],
        )
      : getPostgresPool().query<WaitlistEntry & { created_at: Date | string; updated_at: Date | string }>(
          `SELECT waitlist_entry_id, email, name, source_page, role_or_team, status, note, created_at, updated_at
           FROM waitlist_entries
           ORDER BY created_at DESC`,
        )).then((result) => result.rows.map((row) => mapWaitlistRow(row)));
  }

  if (status) {
    return getDb()
      .prepare(
        `SELECT waitlist_entry_id, email, name, source_page, role_or_team, status, note, created_at, updated_at
         FROM waitlist_entries
         WHERE status = ?
         ORDER BY created_at DESC`,
      )
      .all(status) as WaitlistEntry[];
  }

  return getDb()
    .prepare(
      `SELECT waitlist_entry_id, email, name, source_page, role_or_team, status, note, created_at, updated_at
       FROM waitlist_entries
       ORDER BY created_at DESC`,
    )
    .all() as WaitlistEntry[];
}

export function updateWaitlistEntry(input: { waitlistEntryId: string; status?: WaitlistStatus; note?: string }): boolean | Promise<boolean> {
  if (getDatabaseProvider() === "postgres") {
    const updates: string[] = ["updated_at = $1"];
    const values: Array<string | null> = [new Date().toISOString()];

    if (input.status) {
      updates.push(`status = $${values.length + 1}`);
      values.push(input.status);
    }

    if (typeof input.note === "string") {
      updates.push(`note = $${values.length + 1}`);
      values.push(input.note.trim() || null);
    }

    values.push(input.waitlistEntryId);
    return getPostgresPool()
      .query(`UPDATE waitlist_entries SET ${updates.join(", ")} WHERE waitlist_entry_id = $${values.length}`, values)
      .then((result) => (result.rowCount ?? 0) > 0);
  }

  const current = getDb()
    .prepare("SELECT waitlist_entry_id FROM waitlist_entries WHERE waitlist_entry_id = ?")
    .get(input.waitlistEntryId) as { waitlist_entry_id?: string } | undefined;

  if (!current?.waitlist_entry_id) return false;

  const updates: string[] = ["updated_at = ?"];
  const values: Array<string | null> = [new Date().toISOString()];

  if (input.status) {
    updates.push("status = ?");
    values.push(input.status);
  }

  if (typeof input.note === "string") {
    updates.push("note = ?");
    values.push(input.note.trim() || null);
  }

  values.push(input.waitlistEntryId);
  getDb()
    .prepare(`UPDATE waitlist_entries SET ${updates.join(", ")} WHERE waitlist_entry_id = ?`)
    .run(...values);

  return true;
}
