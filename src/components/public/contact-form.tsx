import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function ContactForm() {
  return (
    <Card className="space-y-5 p-card-lg">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Request Validation Audit</h2>
        <p className="text-sm text-text-neutral">Share the strategy context and intended review scope. We respond within two business days.</p>
      </div>

      <form className="grid gap-4" action="#" method="post">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Name</span>
          <input className="h-10 rounded-sm border px-3" name="name" type="text" required />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Email</span>
          <input className="h-10 rounded-sm border px-3" name="email" type="email" required />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Strategy Type</span>
          <input className="h-10 rounded-sm border px-3" name="strategyType" type="text" placeholder="Trend, mean reversion, intraday, multi-factor..." required />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Message</span>
          <textarea className="min-h-28 rounded-sm border px-3 py-2" name="message" required />
        </label>
        <Button type="submit" className="w-full sm:w-fit">
          Request Validation Audit
        </Button>
      </form>
    </Card>
  );
}
