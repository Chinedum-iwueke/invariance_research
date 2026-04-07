"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useTheme } from "@/components/theme/theme-provider";

type MediaKind = "video" | "image";

type MediaCandidate = {
  kind: MediaKind;
  src: string;
  mimeType?: string;
};

const MEDIA_CANDIDATES: MediaCandidate[] = [
  { kind: "video", src: "/overlay_graphic.webm", mimeType: "video/webm" },
  { kind: "video", src: "/overlay_graphic.mp4", mimeType: "video/mp4" },
  { kind: "video", src: "/overlay_graphic.mov", mimeType: "video/quicktime" },
  { kind: "image", src: "/overlay_graphic.avif" },
  { kind: "image", src: "/overlay_graphic.webp" },
  { kind: "image", src: "/overlay_graphic.png" },
  { kind: "image", src: "/overlay_graphic.jpg" },
  { kind: "image", src: "/overlay_graphic.jpeg" },
  { kind: "image", src: "/overlay_graphic.gif" },
];

async function canLoadFromPublicRoot(src: string): Promise<boolean> {
  const headResponse = await fetch(src, { method: "HEAD", cache: "no-store" });

  if (headResponse.ok) {
    return true;
  }

  if (headResponse.status !== 405) {
    return false;
  }

  const rangeResponse = await fetch(src, {
    method: "GET",
    cache: "no-store",
    headers: { Range: "bytes=0-0" },
  });

  return rangeResponse.ok || rangeResponse.status === 206;
}

export function HeroOverlayBackground() {
  const { theme } = useTheme();
  const [resolvedCandidate, setResolvedCandidate] = useState<MediaCandidate | null>(null);
  const [hasResolutionAttempt, setHasResolutionAttempt] = useState(false);

  const isDarkTheme = theme === "dark";
  const mediaOpacityClass = isDarkTheme ? "opacity-[0.24]" : "opacity-[0.11]";
  const washClass = isDarkTheme ? "bg-black/50" : "bg-white/70";
  const baseGradientClass = isDarkTheme
    ? "bg-gradient-to-br from-[#131519] via-[#171b20] to-[#121417]"
    : "bg-gradient-to-br from-white via-[#fcfbf9] to-[#f7f4f0]";

  useEffect(() => {
    let ignore = false;

    const resolveOverlayCandidate = async () => {
      for (const candidate of MEDIA_CANDIDATES) {
        try {
          const exists = await canLoadFromPublicRoot(candidate.src);

          if (!ignore && exists) {
            setResolvedCandidate(candidate);
            setHasResolutionAttempt(true);
            return;
          }
        } catch {
          // Ignore individual candidate probe errors and keep walking fallback chain.
        }
      }

      if (!ignore) {
        setResolvedCandidate(null);
        setHasResolutionAttempt(true);
      }
    };

    setResolvedCandidate(null);
    setHasResolutionAttempt(false);
    void resolveOverlayCandidate();

    return () => {
      ignore = true;
    };
  }, []);

  let mediaNode = null;

  if (resolvedCandidate) {
    if (resolvedCandidate.kind === "video") {
      mediaNode = (
        <video
          key={resolvedCandidate.src}
          src={resolvedCandidate.src}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${mediaOpacityClass}`}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        />
      );
    } else {
      mediaNode = (
        <Image
          key={resolvedCandidate.src}
          src={resolvedCandidate.src}
          alt=""
          aria-hidden="true"
          fill
          priority
          sizes="100vw"
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${mediaOpacityClass}`}
        />
      );
    }
  }

  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className={`absolute inset-0 ${baseGradientClass}`} />
      {mediaNode}
      <div className={`absolute inset-0 transition-colors duration-300 ${washClass}`} />
      {hasResolutionAttempt && !resolvedCandidate ? (
        <div
          className={isDarkTheme ? "absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(182,70,88,0.12),transparent_40%)]" : "absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(176,0,32,0.08),transparent_42%)]"}
        />
      ) : null}
    </div>
  );
}
