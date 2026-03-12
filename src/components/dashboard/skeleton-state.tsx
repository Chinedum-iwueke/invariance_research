export function SkeletonState({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3 rounded-md border bg-white p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 rounded-sm bg-surface-panel" />
      ))}
    </div>
  );
}
