import type { ReportSnapshotStatus } from "@/lib/server/exports/models";
import type { ShareTokenStatus } from "@/lib/server/share/models";

export function assertShareCanBeCreated(snapshotStatus: ReportSnapshotStatus) {
  if (snapshotStatus !== "active") throw new Error("report_snapshot_superseded");
}

export function assertShareCanBeRevoked(status: ShareTokenStatus) {
  if (status !== "active" && status !== "revoked") throw new Error("share_invalid_state");
}

