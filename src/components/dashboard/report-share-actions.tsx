"use client";

import { useCallback, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";

interface SnapshotResponse {
  snapshot?: {
    snapshot_id: string;
    status: string;
    report_schema_version: string;
    generated_at: string;
    warning_count: number;
    included_diagnostics: string[];
    excluded_diagnostics: Array<{ diagnostic: string; status: string; reason?: string }>;
  };
}

interface ShareResponse {
  share_id: string;
  token: string;
  url: string;
  expires_at?: string;
}

export function ReportShareActions({ analysisId, initialSnapshotId }: { analysisId: string; initialSnapshotId?: string }) {
  const [snapshot, setSnapshot] = useState<SnapshotResponse["snapshot"] | undefined>(
    initialSnapshotId
      ? {
          snapshot_id: initialSnapshotId,
          status: "active",
          report_schema_version: "strategy_truth_room_report_snapshot_v1",
          generated_at: "",
          warning_count: 0,
          included_diagnostics: [],
          excluded_diagnostics: [],
        }
      : undefined,
  );
  const [share, setShare] = useState<ShareResponse | undefined>();
  const [busy, setBusy] = useState<"snapshot" | "share" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ensureSnapshot = useCallback(async () => {
    setBusy("snapshot");
    setError(null);
    try {
      const response = await fetch(`/api/analyses/${analysisId}/report-snapshot`, { method: "POST" });
      const payload = (await response.json()) as SnapshotResponse & { error?: { message?: string } };
      if (!response.ok || !payload.snapshot) throw new Error(payload.error?.message ?? "Snapshot generation failed.");
      setSnapshot(payload.snapshot);
      return payload.snapshot;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Snapshot generation failed.");
      return undefined;
    } finally {
      setBusy(null);
    }
  }, [analysisId]);

  const createShare = useCallback(async () => {
    setBusy("share");
    setError(null);
    try {
      const activeSnapshot = snapshot ?? await ensureSnapshot();
      if (!activeSnapshot) return;
      const response = await fetch(`/api/report-snapshots/${activeSnapshot.snapshot_id}/shares`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = (await response.json()) as ShareResponse & { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "Share creation failed.");
      setShare(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Share creation failed.");
    } finally {
      setBusy(null);
    }
  }, [ensureSnapshot, snapshot]);

  return (
    <div className="rounded-md border border-border-subtle bg-surface-subtle p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" onClick={() => void ensureSnapshot()} disabled={busy !== null}>
          {busy === "snapshot" ? "Generating..." : snapshot ? "Regenerate if stale" : "Generate snapshot"}
        </Button>
        <Button type="button" onClick={() => void createShare()} disabled={busy !== null}>
          {busy === "share" ? "Creating link..." : "Create share room link"}
        </Button>
        {share ? (
          <a className={buttonVariants({ variant: "secondary" })} href={share.url} target="_blank" rel="noreferrer">
            Open share room
          </a>
        ) : null}
      </div>
      <div className="mt-3 space-y-2 text-sm leading-6 text-text-neutral">
        <p>
          Snapshot: {snapshot ? `${snapshot.snapshot_id.slice(0, 8)} / ${snapshot.report_schema_version}` : "not generated yet"}.
          {snapshot ? ` Included diagnostics: ${snapshot.included_diagnostics.length}; excluded: ${snapshot.excluded_diagnostics.length}.` : ""}
        </p>
        <p>Share Room is view-only by default: no raw trade files, no owner account IDs, no raw engine payload, and no public PDF download.</p>
        {share ? <p>Share link expires {share.expires_at ?? "according to account policy"}.</p> : null}
        {error ? <p className="text-chart-negative">{error}</p> : null}
      </div>
    </div>
  );
}
