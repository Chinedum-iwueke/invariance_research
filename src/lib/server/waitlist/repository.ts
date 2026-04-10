import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/server/persistence/database";

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

export function listWaitlistEntries(status?: WaitlistStatus): WaitlistEntry[] {
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

export function updateWaitlistEntry(input: { waitlistEntryId: string; status?: WaitlistStatus; note?: string }) {
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
