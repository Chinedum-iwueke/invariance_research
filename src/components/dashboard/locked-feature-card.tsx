import { Lock } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function LockedFeatureCard({ title, body }: { title: string; body: string }) {
  return (
    <Card className="space-y-4 border-brand/20 bg-brand/5 p-card-md">
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4 text-brand" />
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      <p className="text-sm text-text-neutral">{body}</p>
      <div className="flex gap-2">
        <a href="/pricing" className={buttonVariants({ size: "sm" })}>Unlock full diagnostics</a>
        <a href="/contact" className={buttonVariants({ size: "sm", variant: "secondary" })}>Request audit</a>
      </div>
    </Card>
  );
}
