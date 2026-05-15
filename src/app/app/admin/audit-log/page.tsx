import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { AdminTable } from "@/components/admin/admin-table";
import { listAdminAuditLog } from "@/lib/server/admin/audit-log";

export default async function AdminAuditLogPage() {
  const rows = await listAdminAuditLog(150);

  return (
    <AdminPageShell title="Audit Log" description="Internal record of privileged administrative actions.">
      <AdminTable>
        <thead className="border-b bg-surface-panel text-xs uppercase text-text-neutral">
          <tr><th className="px-3 py-2">Time</th><th>Actor</th><th>Action</th><th>Resource</th><th>Metadata</th><th>Request</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-border-subtle/60 align-top text-xs">
              <td className="px-3 py-2">{row.created_at}</td>
              <td>{row.actor_email ?? "-"}<div className="text-text-neutral">{row.actor_user_id ?? "-"}</div></td>
              <td>{row.action}</td>
              <td>{row.resource_type}<div className="text-text-neutral">{row.resource_id ?? "-"}</div></td>
              <td><pre className="max-w-xs whitespace-pre-wrap text-[11px] text-text-neutral">{JSON.stringify(row.metadata ?? {}, null, 2)}</pre></td>
              <td>{row.ip_address ?? "-"}<div className="max-w-xs truncate text-text-neutral">{row.user_agent ?? "-"}</div></td>
            </tr>
          ))}
        </tbody>
      </AdminTable>
    </AdminPageShell>
  );
}
