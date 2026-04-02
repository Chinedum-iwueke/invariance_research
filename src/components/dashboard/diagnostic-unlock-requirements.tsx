export function DiagnosticUnlockRequirements({ items }: { items: string[] }) {
  return (
    <div className="space-y-2 rounded-sm border bg-surface-white p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-neutral">What would unlock this</p>
      <ul className="list-disc space-y-1 pl-5 text-sm text-text-neutral">
        {items.map((item, index) => (
          <li key={`unlock-${index}-${item.slice(0, 24)}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
