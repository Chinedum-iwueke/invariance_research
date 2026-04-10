"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type PublicationTOCItem = {
  id: string;
  title: string;
};

type PublicationTOCProps = {
  items: PublicationTOCItem[];
};

export function PublicationTOC({ items }: PublicationTOCProps) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");

  useEffect(() => {
    const headings = items
      .map((item) => document.getElementById(item.id))
      .filter((node): node is HTMLElement => Boolean(node));
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target?.id) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        rootMargin: "-22% 0px -68% 0px",
        threshold: [0.1, 0.4, 0.8],
      },
    );

    headings.forEach((heading) => observer.observe(heading));
    return () => observer.disconnect();
  }, [items]);

  if (items.length < 2) return null;

  return (
    <nav className="space-y-3" aria-label="Publication sections">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-text-neutral">On this page</p>
      <ul className="space-y-2.5 text-sm leading-5">
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className={cn(
                  "block border-l pl-3 transition-colors",
                  active ? "border-brand text-text-institutional" : "border-border-subtle text-text-neutral hover:text-text-institutional",
                )}
              >
                {item.title}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
