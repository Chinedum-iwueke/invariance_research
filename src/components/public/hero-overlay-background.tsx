"use client";

import Image from "next/image";
import { useState } from "react";
import { useTheme } from "@/components/theme/theme-provider";

const HERO_OVERLAY_SRC = "/overlay_graphic.png";

export function HeroOverlayBackground() {
  const { theme } = useTheme();
  const [imageUnavailable, setImageUnavailable] = useState(false);

  const isDarkTheme = theme === "dark";
  const mediaOpacityClass = isDarkTheme ? "opacity-[0.74]" : "opacity-[0.84]";
  const globalWashClass = isDarkTheme ? "bg-black/30" : "bg-white/34";
  const directionalWashClass = isDarkTheme
    ? "bg-[linear-gradient(90deg,rgba(12,14,18,0.78)_0%,rgba(12,14,18,0.58)_34%,rgba(12,14,18,0.18)_58%,rgba(12,14,18,0.00)_78%)]"
    : "bg-[linear-gradient(90deg,rgba(255,255,255,0.84)_0%,rgba(255,255,255,0.62)_34%,rgba(255,255,255,0.26)_58%,rgba(255,255,255,0.00)_78%)]";
  const baseGradientClass = isDarkTheme
    ? "bg-gradient-to-br from-[#131519] via-[#171b20] to-[#121417]"
    : "bg-gradient-to-br from-white via-[#fcfbf9] to-[#f7f4f0]";

  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className={`absolute inset-0 ${baseGradientClass}`} />
      {!imageUnavailable ? (
        <Image
          src={HERO_OVERLAY_SRC}
          alt=""
          aria-hidden="true"
          fill
          priority
          sizes="100vw"
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${mediaOpacityClass}`}
          onError={() => setImageUnavailable(true)}
        />
      ) : null}
      <div className={`absolute inset-0 transition-colors duration-300 ${globalWashClass}`} />
      <div className={`absolute inset-0 transition-colors duration-300 ${directionalWashClass}`} />
      {imageUnavailable ? (
        <div
          className={
            isDarkTheme
              ? "absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(182,70,88,0.22),transparent_42%)]"
              : "absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(176,0,32,0.12),transparent_44%)]"
          }
        />
      ) : null}
    </div>
  );
}
