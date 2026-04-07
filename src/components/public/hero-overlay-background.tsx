"use client";

import Image from "next/image";
import { useState } from "react";
import { useTheme } from "@/components/theme/theme-provider";

const HERO_OVERLAY_SRC = "/overlay_graphic.png";

export function HeroOverlayBackground() {
  const { theme } = useTheme();
  const [imageUnavailable, setImageUnavailable] = useState(false);

  const isDarkTheme = theme === "dark";
  const mediaOpacityClass = isDarkTheme ? "opacity-[0.20]" : "opacity-[0.12]";
  const washClass = isDarkTheme ? "bg-black/58" : "bg-white/78";
  const baseGradientClass = isDarkTheme
    ? "bg-gradient-to-br from-[#131519] via-[#171b20] to-[#121417]"
    : "bg-gradient-to-br from-white via-[#fcfbf9] to-[#f7f4f0]";

  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className={`absolute inset-0 ${baseGradientClass}`} />
      {!imageUnavailable ? (
          key={candidate.src}
          src={candidate.src}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${mediaOpacityClass}`}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          onLoadedData={handleMediaSuccess}
          onError={handleMediaError}
        />
      );
    } else {
      mediaNode = (
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
      <div className={`absolute inset-0 transition-colors duration-300 ${washClass}`} />
      {imageUnavailable ? (
        <div
          className={isDarkTheme ? "absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(182,70,88,0.12),transparent_40%)]" : "absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(176,0,32,0.08),transparent_42%)]"}
        />
      ) : null}
    </div>
  );
}
