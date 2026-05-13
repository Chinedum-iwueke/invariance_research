"use client";

import { Play, X } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type Video = {
  id: string;
  title: string;
  description: string;
  youtube_url: string;
  category: string;
  episode_number: number;
  duration: string | null;
  thumbnail: string | null;
};

const TRACKS = [
  { key: "all", label: "All Episodes" },
  { key: "strategy_foundations", label: "Strategy Foundations" },
  { key: "execution_microstructure", label: "Execution & Microstructure" },
  { key: "robustness_risk", label: "Robustness & Risk" },
  { key: "research_workflow", label: "Research Workflow" },
  { key: "advanced_diagnostics", label: "Advanced Diagnostics" },
] as const;

function extractYoutubeId(url: string) {
  return url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/)?.[1] ?? "";
}

function categoryLabel(category: string) {
  return category.replaceAll("_", " ");
}

export function ResearchVideoLibrary({ videos }: { videos: Video[] }) {
  const [track, setTrack] = useState("all");
  const [active, setActive] = useState<Video | null>(null);
  const filtered = useMemo(() => (track === "all" ? videos : videos.filter((video) => video.category === track)), [track, videos]);
  const counts = (key: string) => (key === "all" ? videos.length : videos.filter((video) => video.category === key).length);

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[240px_1fr] lg:gap-8">
      <aside className="min-w-0 max-w-full overflow-hidden lg:space-y-2 lg:overflow-visible" aria-label="Video filters">
        <div className="flex max-w-full gap-2 overflow-x-auto pb-2 lg:block lg:overflow-visible lg:pb-0">
          {TRACKS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTrack(item.key)}
              className={cn(
                "flex min-h-10 shrink-0 items-center justify-between gap-3 rounded-full border px-3.5 py-2 text-left text-sm transition-colors lg:w-full lg:rounded-sm",
                track === item.key ? "border-brand bg-brand/5 text-brand" : "border-border-subtle bg-surface-white text-text-graphite hover:border-brand/40",
              )}
              aria-current={track === item.key ? "true" : undefined}
            >
              <span className="whitespace-nowrap lg:whitespace-normal">{item.label}</span>
              <span className="text-xs text-text-neutral">{counts(item.key)}</span>
            </button>
          ))}
        </div>
      </aside>

      <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((video) => (
          <article key={video.id} className="overflow-hidden rounded-sm border border-border-subtle bg-surface-white shadow-soft">
            <div className="h-1 w-full bg-brand" />
            <div className="relative aspect-video bg-surface-panel">
              <img src={video.thumbnail ?? "/overlay_graphic.png"} alt="" className="h-full w-full object-cover" />
            </div>
            <div className="space-y-3 p-4">
              <p className="text-[11px] uppercase tracking-[0.12em] text-text-neutral">
                Episode {video.episode_number} · {categoryLabel(video.category)}
              </p>
              <h3 className="text-base font-semibold leading-snug">{video.title}</h3>
              <p className="line-clamp-2 text-sm leading-relaxed text-text-neutral">{video.description}</p>
              <div className="flex items-center justify-between gap-3 pt-1">
                {video.duration ? <p className="text-xs text-text-neutral">{video.duration}</p> : <span />}
                <button
                  type="button"
                  onClick={() => setActive(video)}
                  className="inline-flex min-h-10 items-center gap-2 rounded-sm border border-brand px-3 py-2 text-sm font-medium text-brand transition-colors hover:bg-brand hover:text-white"
                >
                  <Play className="h-3.5 w-3.5" />
                  Watch
                </button>
              </div>
            </div>
          </article>
        ))}
        {filtered.length === 0 ? <p className="text-sm text-text-neutral">Published episodes will appear here.</p> : null}
      </div>

      {active ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-3 md:p-4" onClick={() => setActive(null)}>
          <div className="w-full max-w-4xl rounded-sm bg-surface-white p-3 shadow-raised md:p-4" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold md:text-base">{active.title}</h4>
              <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-border-subtle" onClick={() => setActive(null)} aria-label="Close video">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="aspect-video">
              <iframe className="h-full w-full rounded-sm" src={`https://www.youtube.com/embed/${extractYoutubeId(active.youtube_url)}`} allowFullScreen />
            </div>
            <p className="mt-3 text-sm leading-relaxed text-text-neutral">{active.description}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
