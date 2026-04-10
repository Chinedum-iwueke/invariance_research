"use client";

import Image from "next/image";
import { useState } from "react";
import { useTheme } from "@/components/theme/theme-provider";

const DEFAULT_HERO_OVERLAY_SRC = "/overlay_graphic.png";

export function HeroOverlayBackground({ src = DEFAULT_HERO_OVERLAY_SRC }: { src?: string }) {
  const { theme } = useTheme();
  const [imageUnavailable, setImageUnavailable] = useState(false);

  const isDarkTheme = theme === "dark";
  const mediaOpacityClass = isDarkTheme ? "opacity-[0.82]" : "opacity-[0.88]";
  const globalWashClass = isDarkTheme ? "bg-black/38" : "bg-white/36";
  const directionalWashClass = isDarkTheme
    ? "bg-[linear-gradient(90deg,rgba(10,12,16,0.88)_0%,rgba(10,12,16,0.70)_35%,rgba(10,12,16,0.30)_60%,rgba(10,12,16,0.00)_83%)]"
    : "bg-[linear-gradient(90deg,rgba(255,255,255,0.90)_0%,rgba(255,255,255,0.70)_35%,rgba(255,255,255,0.34)_60%,rgba(255,255,255,0.00)_83%)]";
  const rightRevealClass = isDarkTheme
    ? "bg-[radial-gradient(78%_88%_at_82%_52%,rgba(182,70,88,0.24)_0%,rgba(182,70,88,0.10)_34%,rgba(18,20,24,0.00)_72%)]"
    : "bg-[radial-gradient(78%_88%_at_82%_52%,rgba(176,0,32,0.17)_0%,rgba(176,0,32,0.07)_34%,rgba(255,255,255,0.00)_72%)]";
  const baseGradientClass = isDarkTheme
    ? "bg-gradient-to-br from-[#0f1216] via-[#15191e] to-[#111419]"
    : "bg-gradient-to-br from-[#ffffff] via-[#fcfbf9] to-[#f6f1eb]";

  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className={`absolute inset-0 ${baseGradientClass}`} />
      {!imageUnavailable ? (
        <Image
          src={src}
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
      <div className={`absolute inset-0 transition-colors duration-300 ${rightRevealClass}`} />
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
