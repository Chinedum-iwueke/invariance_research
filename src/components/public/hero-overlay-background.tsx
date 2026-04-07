"use client";

import Image from "next/image";
import { useState } from "react";
import { useTheme } from "@/components/theme/theme-provider";

type MediaKind = "video" | "image";

type MediaCandidate = {
  kind: MediaKind;
  src: string;
  mimeType?: string;
};

const MEDIA_CANDIDATES: MediaCandidate[] = [
  { kind: "video", src: "/assets/overlay_graphic.webm", mimeType: "video/webm" },
  { kind: "video", src: "/assets/overlay_graphic.mp4", mimeType: "video/mp4" },
  { kind: "video", src: "/assets/overlay_graphic.mov", mimeType: "video/quicktime" },
  { kind: "image", src: "/assets/overlay_graphic.avif" },
  { kind: "image", src: "/assets/overlay_graphic.webp" },
  { kind: "image", src: "/assets/overlay_graphic.png" },
  { kind: "image", src: "/assets/overlay_graphic.jpg" },
  { kind: "image", src: "/assets/overlay_graphic.jpeg" },
  { kind: "image", src: "/assets/overlay_graphic.gif" },
];

export function HeroOverlayBackground() {
  const { theme } = useTheme();
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [hasResolvedAsset, setHasResolvedAsset] = useState(false);

  const candidate = MEDIA_CANDIDATES[candidateIndex];
  const hasCandidate = candidateIndex < MEDIA_CANDIDATES.length;

  const isDarkTheme = theme === "dark";
  const mediaOpacityClass = isDarkTheme ? "opacity-[0.24]" : "opacity-[0.11]";
  const washClass = isDarkTheme ? "bg-black/50" : "bg-white/70";
  const baseGradientClass = isDarkTheme
    ? "bg-gradient-to-br from-[#131519] via-[#171b20] to-[#121417]"
    : "bg-gradient-to-br from-white via-[#fcfbf9] to-[#f7f4f0]";

  const handleMediaError = () => {
    setHasResolvedAsset(false);
    setCandidateIndex((current) => Math.min(current + 1, MEDIA_CANDIDATES.length));
  };

  const handleMediaSuccess = () => {
    setHasResolvedAsset(true);
  };

  let mediaNode = null;

  if (hasCandidate && candidate) {
    if (candidate.kind === "video") {
      mediaNode = (
        <video
          key={candidate.src}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${mediaOpacityClass}`}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          onLoadedData={handleMediaSuccess}
          onError={handleMediaError}
        >
          <source src={candidate.src} type={candidate.mimeType} />
        </video>
      );
    } else {
      mediaNode = (
        <Image
          key={candidate.src}
          src={candidate.src}
          alt=""
          aria-hidden="true"
          fill
          priority
          sizes="100vw"
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${mediaOpacityClass}`}
          onLoad={handleMediaSuccess}
          onError={handleMediaError}
        />
      );
    }
  }

  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className={`absolute inset-0 ${baseGradientClass}`} />
      {mediaNode}
      <div className={`absolute inset-0 transition-colors duration-300 ${washClass}`} />
      {!hasResolvedAsset && !hasCandidate ? (
        <div
          className={isDarkTheme ? "absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(182,70,88,0.12),transparent_40%)]" : "absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(176,0,32,0.08),transparent_42%)]"}
        />
      ) : null}
    </div>
  );
}
