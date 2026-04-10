"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ResearchDeskWaitlistForm({ sourcePage = "/research-desk" }: { sourcePage?: string }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    const response = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, sourcePage }),
    }).catch(() => null);

    if (!response) {
      setStatus("error");
      setMessage("Unable to submit right now. Please retry shortly.");
      return;
    }

    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    if (!response.ok) {
      setStatus("error");
      setMessage(payload?.message ?? "Please enter a valid email and try again.");
      return;
    }

    setStatus("success");
    setMessage(payload?.message ?? "You are on the waitlist.");
    setEmail("");
    setName("");
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-text-neutral">Email <span className="text-brand">*</span></span>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@firm.com"
            className="h-11 w-full rounded-sm border border-border-subtle bg-surface-white px-3"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-text-neutral">Name (optional)</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Alex Morgan"
            className="h-11 w-full rounded-sm border border-border-subtle bg-surface-white px-3"
          />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={status === "loading"}>{status === "loading" ? "Submitting…" : "Join the Waitlist"}</Button>
        {status === "success" ? <p className="text-sm text-text-graphite">{message}</p> : null}
        {status === "error" ? <p className="text-sm text-brand">{message}</p> : null}
      </div>
    </form>
  );
}
