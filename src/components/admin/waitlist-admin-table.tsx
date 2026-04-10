"use client";

import { useState } from "react";
import type { WaitlistEntry, WaitlistStatus } from "@/lib/server/waitlist/repository";

const STATUSES: WaitlistStatus[] = ["new", "contacted", "invited", "archived"];

export function WaitlistAdminTable({ entries }: { entries: WaitlistEntry[] }) {
  const [rows, setRows] = useState(entries);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function patchRow(waitlistEntryId: string, payload: { status?: WaitlistStatus; note?: string }) {
    setPendingId(waitlistEntryId);
    try {
      const response = await fetch(`/api/admin/waitlist/${waitlistEntryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) return;
      setRows((current) =>
        current.map((row) =>
          row.waitlist_entry_id === waitlistEntryId
            ? {
                ...row,
                ...payload,
                updated_at: new Date().toISOString(),
              }
            : row,
        ),
      );
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="overflow-x-auto rounded-sm border border-border-subtle bg-surface-white">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b bg-surface-panel text-xs uppercase text-text-neutral">
          <tr>
            <th className="px-3 py-2">Email</th>
            <th>Name</th>
            <th>Source</th>
            <th>Created</th>
            <th>Status</th>
            <th className="min-w-[18rem]">Note</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item.waitlist_entry_id} className="border-b border-border-subtle/60 align-top text-xs">
              <td className="px-3 py-2">{item.email}</td>
              <td className="py-2">{item.name ?? "-"}</td>
              <td className="py-2">{item.source_page}</td>
              <td className="py-2">{new Date(item.created_at).toLocaleString()}</td>
              <td className="py-2">
                <select
                  className="h-8 rounded-sm border border-border-subtle bg-surface-white px-2"
                  value={item.status}
                  disabled={pendingId === item.waitlist_entry_id}
                  onChange={(event) => patchRow(item.waitlist_entry_id, { status: event.target.value as WaitlistStatus })}
                >
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </td>
              <td className="py-2 pr-3">
                <input
                  className="h-8 w-full rounded-sm border border-border-subtle bg-surface-white px-2"
                  defaultValue={item.note ?? ""}
                  placeholder="Add internal note"
                  onBlur={(event) => patchRow(item.waitlist_entry_id, { note: event.target.value })}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
