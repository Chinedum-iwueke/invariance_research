"use client";

import { useMemo, useState } from "react";
import { ArrowRight, LockKeyhole, Mail } from "lucide-react";

type Status = {
  tone: "neutral" | "success" | "error";
  message: string;
};

function safeNextPath(nextPath: string) {
  if (!nextPath.startsWith("/") || nextPath.startsWith("//")) return "/app";
  if (nextPath.startsWith("/coming-soon")) return "/app";
  return nextPath;
}

export function PreviewGateForm({ nextPath = "/app" }: { nextPath?: string }) {
  const destination = useMemo(() => safeNextPath(nextPath), [nextPath]);
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [passwordStatus, setPasswordStatus] = useState<Status | null>(null);
  const [waitlistStatus, setWaitlistStatus] = useState<Status | null>(null);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [waitlistBusy, setWaitlistBusy] = useState(false);

  async function submitPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordBusy(true);
    setPasswordStatus(null);
    const response = await fetch("/api/preview-gate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setPasswordStatus({ tone: "error", message: payload?.message ?? "Preview access could not be verified." });
      setPasswordBusy(false);
      return;
    }
    window.location.assign(destination);
  }

  async function requestAccess(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWaitlistBusy(true);
    setWaitlistStatus(null);
    const response = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, sourcePage: "preview_gate" }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setWaitlistStatus({ tone: "error", message: payload?.message ?? "Access request could not be submitted." });
      setWaitlistBusy(false);
      return;
    }
    setEmail("");
    setWaitlistBusy(false);
    setWaitlistStatus({ tone: "success", message: payload?.message ?? "Access request received." });
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <form onSubmit={submitPassword} className="artifact-surface space-y-4 p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-border-subtle bg-surface-subtle text-brand">
            <LockKeyhole className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold">Enter access password</h2>
            <p className="mt-1 text-sm leading-6 text-text-neutral">Use the password shared with your team to open the private workspace.</p>
          </div>
        </div>
        <label className="block text-sm font-medium text-text-graphite">
          Password
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete="current-password"
            required
            className="mt-2 min-h-11 w-full rounded-sm border border-border-subtle bg-white px-3 py-2 text-text-institutional shadow-sm outline-none transition focus:border-brand"
          />
        </label>
        {passwordStatus ? (
          <p className={passwordStatus.tone === "error" ? "text-sm text-brand" : "text-sm text-evidence-supported"}>{passwordStatus.message}</p>
        ) : null}
        <button
          disabled={passwordBusy}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-sm bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-70"
        >
          {passwordBusy ? "Checking..." : "Open workspace"}
          <ArrowRight className="h-4 w-4" />
        </button>
      </form>

      <form onSubmit={requestAccess} className="card-shell space-y-4 p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-border-subtle bg-surface-subtle text-brand">
            <Mail className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold">Request early access</h2>
            <p className="mt-1 text-sm leading-6 text-text-neutral">Leave your email and we will follow up when another testing seat opens.</p>
          </div>
        </div>
        <label className="block text-sm font-medium text-text-graphite">
          Email
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            autoComplete="email"
            required
            className="mt-2 min-h-11 w-full rounded-sm border border-border-subtle bg-white px-3 py-2 text-text-institutional shadow-sm outline-none transition focus:border-brand"
          />
        </label>
        {waitlistStatus ? (
          <p className={waitlistStatus.tone === "error" ? "text-sm text-brand" : "text-sm text-evidence-supported"}>{waitlistStatus.message}</p>
        ) : null}
        <button
          disabled={waitlistBusy}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-sm border border-border-subtle bg-white px-4 py-2.5 text-sm font-semibold text-text-institutional transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-70"
        >
          {waitlistBusy ? "Sending..." : "Request password"}
        </button>
      </form>
    </div>
  );
}

