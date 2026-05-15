"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function ContactForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        strategyType: form.get("strategyType"),
        message: form.get("message"),
      }),
    });
    const payload = await response.json().catch(() => null) as { message?: string; error?: { message?: string } } | null;
    setMessage(response.ok ? payload?.message ?? "Thank you. We received your request." : payload?.error?.message ?? "Unable to submit right now.");
    setBusy(false);
  }

  return (
    <Card className="space-y-5 p-card-lg">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold leading-tight md:text-2xl">Request Validation Audit</h2>
        <p className="text-sm text-text-neutral">Share the strategy context and intended review scope. We respond within two business days.</p>
      </div>

      <form className="grid gap-4" onSubmit={onSubmit}>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Name</span>
          <input className="min-h-11 rounded-sm border px-3" name="name" type="text" required />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Email</span>
          <input className="min-h-11 rounded-sm border px-3" name="email" type="email" required />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Strategy Type</span>
          <input className="min-h-11 rounded-sm border px-3" name="strategyType" type="text" placeholder="Trend, mean reversion, intraday, multi-factor..." required />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Message</span>
          <textarea className="min-h-28 rounded-sm border px-3 py-2" name="message" required />
        </label>
        {message ? <p className="text-sm text-text-neutral">{message}</p> : null}
        <Button type="submit" className="w-full sm:w-fit" disabled={busy}>
          {busy ? "Sending..." : "Request Validation Audit"}
        </Button>
      </form>
    </Card>
  );
}
