import { FileUp } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";

export function UploadPanel() {
  return (
    <Card className="space-y-4 p-card-md">
      <div>
        <h3 className="text-lg font-semibold">Upload Research Artifacts</h3>
        <p className="mt-1 text-sm text-text-neutral">Submit datasets, logs, and model notes for validation intake.</p>
        <Link href="/docs/lab" className="mt-2 inline-block text-xs font-medium text-brand hover:underline">View Docs</Link>
      </div>
      <div className="rounded-md border border-dashed bg-surface-panel/50 p-8 text-center">
        <FileUp className="mx-auto h-6 w-6 text-brand" />
        <p className="mt-3 text-sm font-medium">Drag and drop files here</p>
        <p className="mt-1 text-xs text-text-neutral">CSV, Parquet, JSON, PDF · max 100MB per file</p>
      </div>
      <div className="rounded-sm border bg-surface-panel p-3 text-xs text-text-neutral">Status: Awaiting secure transfer initialization.</div>
    </Card>
  );
}
