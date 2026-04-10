"use client";

import { useState } from "react";

type PublicationCopyLinkButtonProps = {
  className?: string;
};

export function PublicationCopyLinkButton({ className }: PublicationCopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" onClick={onCopy} className={className}>
      {copied ? "Link copied" : "Copy link"}
    </button>
  );
}
