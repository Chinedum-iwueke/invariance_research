"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ResearchDeskWaitlistForm({ sourcePage = "/research-desk" }: { sourcePage?: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    const response = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, sourcePage }),
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
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start">
        <label className="w-full space-y-1 text-sm">
          <span className="text-text-neutral">
            Email <span className="text-brand">*</span>
          </span>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Enter your email"
            className="h-11 w-full rounded-sm border border-border-subtle bg-surface-white px-3"
          />
        </label>
        <Button className="md:mt-[1.35rem]" type="submit" disabled={status === "loading"}>
          {status === "loading" ? "Submitting…" : "Join the Waitlist"}
        </Button>
      </div>
      <div className="min-h-5">
        {status === "success" ? <p className="text-sm text-text-graphite">{message}</p> : null}
        {status === "error" ? <p className="text-sm text-brand">{message}</p> : null}
      </div>
    </form>
  );
}
