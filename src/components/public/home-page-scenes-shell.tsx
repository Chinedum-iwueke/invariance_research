"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ScrollspyRail } from "@/components/public/home-scenes";
import { cn } from "@/lib/utils";

type HomePageScenesShellProps = {
  sceneIds: string[];
  children: ReactNode;
  className?: string;
};

export function HomePageScenesShell({ sceneIds, children, className }: HomePageScenesShellProps) {
  const [heroProgress, setHeroProgress] = useState(0);

  useEffect(() => {
    const handleWindowScroll = () => {
      const viewportHeight = window.innerHeight || 1;
      const progress = Math.min(Math.max(window.scrollY / viewportHeight, 0), 1);
      setHeroProgress(progress);
    };
    handleWindowScroll();
    window.addEventListener("scroll", handleWindowScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleWindowScroll);
  }, []);

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
    <main className={cn("relative bg-surface-panel/55", className)} style={transitionVars}>
      <ScrollspyRail sectionIds={sceneIds} />
      {children}
    </main>
  );
}
