import { ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";

interface ArticleCardProps {
  title: string;
  category: string;
  summary: string;
}

export function ArticleCard({ title, category, summary }: ArticleCardProps) {
  return (
    <Card className="space-y-4 p-card-md">
      <div className="aspect-[16/9] rounded-sm border bg-surface-panel" />
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-neutral">{category}</p>
      <h3 className="text-lg font-semibold leading-tight">{title}</h3>
      <p className="text-sm leading-relaxed text-text-neutral">{summary}</p>
      <p className="inline-flex items-center gap-2 text-sm font-medium text-brand">
        Read Summary <ArrowUpRight className="h-3.5 w-3.5" />
      </p>
    </Card>
  );
}
