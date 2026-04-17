"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function AnalysisArchiveSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const value = searchParams.get("q") ?? "";

  return (
    <label className="relative block">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-neutral" />
      <input
        type="search"
        placeholder="Search by strategy name or analysis ID"
        className="h-10 w-full rounded-md border border-border-subtle bg-surface-white pl-9 pr-3 text-sm text-text-graphite shadow-sm outline-none transition focus:border-border"
        value={value}
        onChange={(event) => {
          const nextValue = event.target.value;
          const params = new URLSearchParams(searchParams.toString());
          if (nextValue.trim()) {
            params.set("q", nextValue);
          } else {
            params.delete("q");
          }
          const query = params.toString();
          router.replace(query ? `${pathname}?${query}` : pathname);
        }}
      />
    </label>
  );
}
