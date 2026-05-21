"use client";

import { useState, type FormEvent } from "react";
import { RESEARCH_DESK_STATUSES, type ResearchDeskRequestRecord, type ResearchDeskRequestStatus } from "@/lib/server/research-desk/models";

const STATUS_LABELS: Record<ResearchDeskRequestStatus, string> = {
  received: "Received",
  scoped: "Scoped",
  quoted: "Quoted",
  in_review: "In review",
  addendum_draft: "Addendum draft",
  approved: "Approved",
  delivered: "Delivered",
  closed: "Closed",
};

export function ResearchDeskAdminTable({ requests }: { requests: ResearchDeskRequestRecord[] }) {
  const [saving, setSaving] = useState<string>();
  const [saved, setSaved] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>, requestId: string) {
    event.preventDefault();
    setSaving(requestId);
    setSaved(undefined);
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/admin/research-desk/requests/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: form.get("status"),
        addendum_status: form.get("addendum_status"),
        internal_note: form.get("internal_note"),
        public_addendum: form.get("public_addendum"),
      }),
    });
    setSaving(undefined);
    if (response.ok) setSaved(requestId);
  }

  if (!requests.length) return <p className="text-sm text-text-neutral">No Research Desk requests yet.</p>;

  return (
    <div className="space-y-4">
      {requests.map((request) => (
        <form key={request.request_id} onSubmit={(event) => submit(event, request.request_id)} className="rounded-sm border border-border-subtle bg-surface-white p-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-sm border border-border-subtle bg-surface-subtle px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-neutral">
                  {STATUS_LABELS[request.status]}
                </span>
                <code className="text-xs text-text-neutral">request={request.request_id.slice(0, 8)}</code>
                <code className="text-xs text-text-neutral">analysis={request.analysis_id.slice(0, 8)}</code>
                <code className="text-xs text-text-neutral">snapshot={request.report_snapshot_id.slice(0, 8)}</code>
              </div>
              <h3 className="mt-3 text-lg font-semibold text-text-institutional">{request.validation_packet.strategy_name}</h3>
              <p className="mt-2 text-sm leading-6 text-text-neutral">{request.trigger_limitation}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {request.requested_services.map((service) => (
                  <span key={service} className="rounded-sm border border-research-red/20 bg-research-red/10 px-2 py-1 text-xs text-research-red">
                    {service.replaceAll("_", " ")}
                  </span>
                ))}
              </div>
              {request.user_note ? <p className="mt-3 rounded-sm border border-border-subtle bg-surface-subtle p-3 text-sm text-text-neutral">{request.user_note}</p> : null}

              <details className="mt-4 rounded-sm border border-border-subtle bg-surface-subtle p-3">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.12em] text-text-graphite">Review packet</summary>
                <div className="mt-3 grid gap-3 text-xs text-text-neutral md:grid-cols-2">
                  <PacketBlock title="Artifact manifest" items={[
                    request.validation_packet.artifact_manifest?.file_name,
                    request.validation_packet.artifact_manifest?.artifact_kind,
                    request.validation_packet.artifact_manifest?.richness,
                    request.validation_packet.artifact_manifest?.checksum_sha256,
                  ]} />
                  <PacketBlock title="Requested questions" items={request.validation_packet.requested_questions ?? []} />
                  <PacketBlock title="Evidence gaps" items={[
                    ...(request.validation_packet.limitations ?? []),
                    ...((request.validation_packet.evidence_ledger ?? [])
                      .filter((entry) => entry.display_status !== "available")
                      .map((entry) => `${entry.diagnostic}: ${entry.engine_reason ?? entry.artifact_reason ?? entry.final_status}`)),
                  ]} />
                  <PacketBlock title="Unsupported claims" items={(request.validation_packet.unsupported_claims ?? []).map((claim) => String(claim.claim ?? claim.claim_id ?? "Unsupported claim"))} />
                  <PacketBlock title="Reviewer checklist" items={request.validation_packet.reviewer_checklist ?? []} />
                  <PacketBlock title="Diagnostics" items={(request.validation_packet.diagnostic_outputs ?? []).map((item) => `${item.diagnostic}: ${item.status}${item.reason ? ` - ${item.reason}` : ""}`)} />
                </div>
              </details>
            </div>

            <div className="space-y-3">
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-text-graphite">Queue status</span>
                <select name="status" defaultValue={request.status} className="w-full rounded-sm border border-border-subtle bg-surface-paper px-2 py-2 text-sm">
                  {RESEARCH_DESK_STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-text-graphite">Addendum status</span>
                <select name="addendum_status" defaultValue="draft" className="w-full rounded-sm border border-border-subtle bg-surface-paper px-2 py-2 text-sm">
                  <option value="draft">draft</option>
                  <option value="approved">approved</option>
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-text-graphite">Internal reviewer note</span>
                <textarea name="internal_note" rows={3} className="w-full resize-none rounded-sm border border-border-subtle bg-surface-paper px-2 py-2 text-sm" />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-text-graphite">Approved report addendum</span>
                <textarea name="public_addendum" rows={3} className="w-full resize-none rounded-sm border border-border-subtle bg-surface-paper px-2 py-2 text-sm" />
              </label>
              <button type="submit" className="w-full rounded-sm bg-research-red px-3 py-2 text-sm font-semibold text-white">
                {saving === request.request_id ? "Saving..." : "Save review"}
              </button>
              {saved === request.request_id ? <p className="text-xs text-chart-positive">Saved.</p> : null}
            </div>
          </div>
        </form>
      ))}
    </div>
  );
}

function PacketBlock({ title, items }: { title: string; items: Array<string | undefined> }) {
  const filtered = items.map((item) => item?.trim()).filter((item): item is string => Boolean(item)).slice(0, 8);
  return (
    <div>
      <p className="font-semibold text-text-graphite">{title}</p>
      {filtered.length ? (
        <ul className="mt-1 space-y-1">
          {filtered.map((item, index) => <li key={`${title}-${index}`}>- {item}</li>)}
        </ul>
      ) : (
        <p className="mt-1">No packet entries.</p>
      )}
    </div>
  );
}
