import { FileUp } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";

export function UploadPanel() {
  return (
    <Card className="space-y-4 p-card-md">
      <div>
        <h3 className="text-lg font-semibold">Upload Trade History</h3>
        <p className="mt-1 text-sm text-text-neutral">Start with a trade CSV or exchange export. Optional ZIP bundles add context, but the launch verdict is trade-path first.</p>
        <div className="mt-2 flex flex-wrap gap-3 text-xs font-medium">
          <Link href="/docs/lab" className="text-brand hover:underline">View upload docs</Link>
          <Link href="/downloads/strategy-truth-room-research-bundle-reference.zip" className="text-brand hover:underline">Download optional ZIP reference</Link>
        </div>
      </div>
      <div className="rounded-md border border-dashed bg-surface-panel/50 p-5 text-center md:p-8">
        <FileUp className="mx-auto h-6 w-6 text-brand" />
        <p className="mt-3 text-sm font-medium">Drop a trade CSV or exchange export</p>
        <p className="mt-1 text-xs text-text-neutral">CSV first · optional Bundle Manifest v1 ZIP for enrichment · plan limits enforced before parsing</p>
      </div>
      <div className="rounded-sm border bg-surface-panel p-3 text-xs text-text-neutral">Status: Awaiting secure transfer initialization.</div>
    </Card>
  );
}
