"use client";

import { useMemo, useRef, useState, type ReactNode, type UIEvent } from "react";
import { ScrollspyRail } from "@/components/public/home-scenes";
import { cn } from "@/lib/utils";

type HomePageScenesShellProps = {
  sceneIds: string[];
  children: ReactNode;
  className?: string;
};

export function HomePageScenesShell({ sceneIds, children, className }: HomePageScenesShellProps) {
  const scrollerRef = useRef<HTMLElement | null>(null);
  const [heroProgress, setHeroProgress] = useState(0);

  const handleScroll = (event: UIEvent<HTMLElement>) => {
    const element = event.currentTarget;
    const viewportHeight = element.clientHeight || 1;
    const progress = Math.min(Math.max(element.scrollTop / viewportHeight, 0), 1);
    setHeroProgress(progress);
  };

  const transitionVars = useMemo(
    () => ({
      ["--hero-shift" as string]: `${(-heroProgress * 22).toFixed(2)}px`,
      ["--hero-opacity" as string]: (1 - heroProgress * 0.16).toFixed(3),
      ["--next-shift" as string]: `${((1 - heroProgress) * 20).toFixed(2)}px`,
      ["--next-opacity" as string]: (0.86 + heroProgress * 0.14).toFixed(3),
    }),
    [heroProgress],
  );

  return (
    <main
      ref={scrollerRef}
      onScroll={handleScroll}
      className={cn("relative h-screen snap-y snap-mandatory overflow-y-auto bg-surface-panel/55", className)}
      style={transitionVars}
    >
      <ScrollspyRail sectionIds={sceneIds} scrollRoot={scrollerRef} />
      {children}
    </main>
  );
}
