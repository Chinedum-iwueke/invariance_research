import type { ReactNode } from "react";

export function AdminTable({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-sm border border-border-subtle bg-white">
      <table className="min-w-full text-left text-sm">{children}</table>
    </div>
  );
}
