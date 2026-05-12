import { Sparkles } from "lucide-react";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";

interface AiSynthesisPanelProps {
  title: string;
  summary?: string;
  bullets?: string[];
  model?: string;
}

export function AiSynthesisPanel({ title, summary, bullets = [], model }: AiSynthesisPanelProps) {
  if (!summary && bullets.length === 0) return null;
  return (
    <WorkspaceCard
      title={title}
      subtitle="Interpretation layer generated after deterministic diagnostics completed."
      toolbar={(
        <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-700/20 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800">
          <Sparkles className="h-3.5 w-3.5" />
          AI-assisted synthesis{model ? ` · ${model}` : ""}
        </span>
      )}
    >
      <div className="space-y-3">
        {summary ? <p className="text-sm leading-relaxed text-text-neutral">{summary}</p> : null}
        {bullets.length ? (
          <ul className="space-y-1.5 text-sm text-text-neutral">
            {bullets.map((item, index) => <li key={`ai-${index}-${item.slice(0, 24)}`}>• {item}</li>)}
          </ul>
        ) : null}
      </div>
    </WorkspaceCard>
  );
}
