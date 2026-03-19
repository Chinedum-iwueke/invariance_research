"use client";

import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { useTheme } from "@/components/theme/theme-provider";
import logoPrimaryDark from "@/assets/Logo-Primary-dark.svg";
import logoPrimaryLight from "@/assets/Logo-Primary.svg";
import logoMonogram from "@/assets/monogram.svg";
import { cn } from "@/lib/utils";

type LogoAssetProps = {
  className?: string;
  priority?: boolean;
};

function LogoAsset({ asset, alt, className, priority }: LogoAssetProps & { asset: StaticImageData; alt: string }) {
  return (
    <Image
      src={asset}
      alt={alt}
      priority={priority}
      className={cn("h-full w-auto", className)}
      sizes="(max-width: 768px) 170px, 280px"
    />
  );
}

export function LogoPrimaryLight({ className, priority }: LogoAssetProps) {
  return <LogoAsset asset={logoPrimaryLight} alt="Invariance Research" className={className} priority={priority} />;
}

export function LogoPrimaryDark({ className, priority }: LogoAssetProps) {
  return <LogoAsset asset={logoPrimaryDark} alt="Invariance Research" className={className} priority={priority} />;
}

export function LogoMonogram({ className, priority }: LogoAssetProps) {
  return <LogoAsset asset={logoMonogram} alt="Invariance Research monogram" className={className} priority={priority} />;
}

export function BrandLogo({ compact = false, className }: { compact?: boolean; className?: string }) {
  const { theme } = useTheme();

  if (compact) {
    return (
      <span className={cn("block h-8 md:h-9", className)} aria-hidden="true">
        <LogoMonogram priority className="object-contain" />
      </span>
    );
  }

  return (
    <span className={cn("block h-8 md:h-10", className)} aria-hidden="true">
      {theme === "dark" ? <LogoPrimaryDark priority className="object-contain" /> : <LogoPrimaryLight priority className="object-contain" />}
    </span>
  );
}

export function BrandLogoLink({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Invariance Research home"
      className={cn(
        "inline-flex h-12 items-center rounded-sm px-1.5 opacity-100 transition-opacity duration-normal hover:opacity-85 focus-visible:ring-brand",
        className,
      )}
    >
      <BrandLogo compact={compact} />
    </Link>
  );
}
