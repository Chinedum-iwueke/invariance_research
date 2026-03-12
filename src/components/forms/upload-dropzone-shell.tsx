import { FileUp } from "lucide-react";
import { Card } from "@/components/ui/card";

export function UploadDropzoneShell() {
  return (
    <Card className="space-y-4 p-card-md">
      <h2 className="text-lg font-semibold">Upload Analysis Artifacts</h2>
      <div className="rounded-md border border-dashed bg-surface-panel/60 p-10 text-center">
        <FileUp className="mx-auto h-6 w-6 text-brand" />
        <p className="mt-3 text-sm font-medium">Drag and drop strategy files</p>
        <p className="mt-1 text-xs text-text-neutral">Accepted: CSV, Parquet, JSON, ZIP report exports</p>
      </div>
      <p className="text-xs text-text-neutral">No files uploaded yet. Parsing and validation workflow will be wired in Phase 4.</p>
    </Card>
  );
}
