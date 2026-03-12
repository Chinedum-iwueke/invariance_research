import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export function EmptyState({ title, body, cta }: { title: string; body: string; cta?: { label: string; href: string } }) {
  return (
    <Card className="p-card-lg text-center">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-text-neutral">{body}</p>
      {cta ? (
        <a href={cta.href} className={cn(buttonVariants({ size: "sm" }), "mt-4")}>
          {cta.label}
        </a>
      ) : null}
    </Card>
  );
}
