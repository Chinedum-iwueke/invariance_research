"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { AnalysisListItem, AnalysisListResponse } from "@/lib/contracts";
import { AnalysisTable } from "@/components/dashboard/analysis-table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { SkeletonState } from "@/components/dashboard/skeleton-state";

export function AnalysesLibrary() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<AnalysisListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const query = (searchParams.get("q") ?? "").trim().toLowerCase();
  const filteredItems = query
    ? items.filter((item) => item.strategy_name.toLowerCase().includes(query) || item.analysis_id.toLowerCase().includes(query))
    : items;

  useEffect(() => {
    void fetch("/api/analyses", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as AnalysisListResponse;
        setItems(payload.items ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonState rows={5} />;

  if (items.length === 0) {
    return (
      <EmptyState
        title="No analyses yet"
        body="Submit a new research artifact to create your first analysis record."
        cta={{ label: "Create New Analysis", href: "/app/new-analysis" }}
      />
    );
  }

  if (filteredItems.length === 0) {
    return (
      <EmptyState
        title="No matching analyses"
        body="Try a different strategy name or analysis ID."
      />
    );
  }

  return <AnalysisTable analyses={filteredItems} />;
}
